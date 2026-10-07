"""Fehlergrenzen der Inhaltswerkzeuge, ohne Netzwerk und produktive Schreibzugriffe."""
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReviewRegressionTests(unittest.TestCase):
    def node(self, code):
        result = subprocess.run(['node', '-e', code], cwd=ROOT, capture_output=True,
                                text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_required_harvest_queries_fail_without_publishing_partial_data(self):
        results = self.node(r"""
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
(async()=>{
 const results=[];
 for(const name of ['wikidata_natura','wikidata_natura_wd2','wikidata_natura_wd3','wikidata_natura_wd4','wikidata_galneb','wikidata_galneb_w3','wikidata_astra_w4']) {
  for(const failAt of (name==='wikidata_astra_w4'?[1,3]:[1,2])) {
   const file=path.resolve('scripts/data_sources/harvest/'+name+'.cjs');
   const realRequire=createRequire(file);let writes=0,calls=0;
   const context=vm.createContext({require:id=>id==='./json_io.cjs'?{writeJsonAtomic:()=>writes++}:realRequire(id),module:{exports:{}},__dirname:path.dirname(file),console:{log(){},warn(){},error(){}},process:{...process,exit:()=>{throw Error('exit')}},setTimeout,URL});
   vm.runInContext(fs.readFileSync(file,'utf8'),context);
   context.fakeSparql=async()=>{if(++calls===failAt)throw Error('HTTP 503');return []};
   vm.runInContext('sparql=fakeSparql;sleep=async()=>{}',context);
   let rejected=false;try{await vm.runInContext('main()',context)}catch{rejected=true}
   results.push({name,failAt,rejected,writes});
  }
 }
 console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1});
""")
        for value in results:
            with self.subTest(**value):
                self.assertTrue(value['rejected'])
                self.assertEqual(value['writes'], 0)

    def test_atomic_writer_preserves_source_on_failed_write(self):
        value = self.node(r"""
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {writeJsonAtomic}=require('./scripts/data_sources/harvest/json_io.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scientia-atomic-'));
const file=path.join(dir,'raw.json');fs.writeFileSync(file,'["Bestand"]');
const original=fs.writeFileSync;let failed=false;
try{
 fs.writeFileSync=(target,...args)=>{if(target!==file){original(target,'["unvollständig');throw Error('ENOSPC')}return original(target,...args)};
 try{writeJsonAtomic(file,['Neu'])}catch{failed=true}
}finally{fs.writeFileSync=original}
console.log(JSON.stringify({failed,source:JSON.parse(fs.readFileSync(file)),files:fs.readdirSync(dir)}));
fs.rmSync(dir,{recursive:true});
""")
        self.assertTrue(value['failed'])
        self.assertEqual(value['source'], ['Bestand'])
        self.assertEqual(value['files'], ['raw.json'])

    def test_explicit_qid_rejects_a_different_guessed_article(self):
        values = self.node(r"""
const {resolveSourceImages}=require('./scripts/data_sources/harvest/wikipedia_image_sources.cjs');
(async()=>{const values=[];
for(const articleQid of ['Q99',undefined,'Q42']){
 const get=async url=>new URL(url).hostname==='www.wikidata.org'?{entities:{Q42:{claims:{}}}}:{query:{pages:{1:{title:'Test',pageprops:{wikibase_item:articleQid},original:{source:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Article.jpg'}}}}};
 values.push([...await resolveSourceImages([{id:'test',name:'Test',sourceUrl:'https://www.wikidata.org/wiki/Q42'}],'cultura',get)]);
}console.log(JSON.stringify(values));})().catch(e=>{console.error(e);process.exitCode=1});
""")
        self.assertEqual(values, [[], [], [['test', 'Article.jpg']]])

    def test_qa_accepts_two_and_three_distinct_options(self):
        spec = importlib.util.spec_from_file_location('scientia_run_qa', ROOT / 'scripts/qa_review/run_qa.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for options in (['A', 'B'], ['A', 'B', 'C']):
            view = dict(id='test', domain='astra', type='test', prompt='Frage?',
                        options=options, keyedAnswer='A')
            self.assertIsNone(module.validate_view(view))
        view['options'] = ['A', 'A']
        self.assertIsNotNone(module.validate_view(view))

    def test_image_search_cache_respects_concept_specific_rejection(self):
        value = self.node(r"""
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const file=path.resolve('scripts/data_sources/harvest/resolve_images.cjs');
const context=vm.createContext({require:createRequire(file),console:{log(){},warn(){},error(){}},process,__dirname:path.dirname(file),URL});
vm.runInContext(fs.readFileSync(file,'utf8').split('(async () => {')[0],context);
vm.runInContext(`apiGet=async()=>({query:{pages:{1:{title:'File:James Webb Space Telescope Mirror37.jpg',imageinfo:[{mime:'image/jpeg',extmetadata:{LicenseShortName:{value:'CC BY 4.0'},Artist:{value:'Autor'}}}]}}}})`,context);
(async()=>{const accepted=await vm.runInContext("resolveConcept('telescope',{id:'mission-webb',category:'mission'},'astra')",context);const rejected=await vm.runInContext("resolveConcept('telescope',{id:'mission-hubble',category:'mission'},'astra')",context);console.log(JSON.stringify({accepted:!!accepted,rejected}));})().catch(e=>{console.error(e);process.exitCode=1});
""")
        self.assertTrue(value['accepted'])
        self.assertIsNone(value['rejected'])

    def test_image_replacement_needs_its_own_license_and_author(self):
        values = self.node(r"""
const {validateCorrection}=require('./scripts/data_sources/harvest/apply_corrections.cjs');
const image={'concept.imageFile':'https://commons.wikimedia.org/wiki/File:New.jpg'};
console.log(JSON.stringify([
 validateCorrection({id:'test',set:image}),
 validateCorrection({id:'test',set:{...image,'concept.imageLicense':'CC BY 4.0'}}),
 validateCorrection({id:'test',set:{...image,'concept.imageLicense':'CC BY 4.0','concept.imageAttribution':'Photographer'}}),
]));
""")
        self.assertIsInstance(values[0], str)
        self.assertIsInstance(values[1], str)
        self.assertIsNone(values[2])

    def test_http_200_api_errors_trip_the_rejection_guard(self):
        value = self.node(r"""
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{EventEmitter}=require('node:events'),{createRequire}=require('node:module');
const file=path.resolve('scripts/data_sources/harvest/resolve_images.cjs'),realRequire=createRequire(file);let calls=0;
const https={get(url,options,callback){calls++;const response=new EventEmitter();response.statusCode=200;response.headers={};queueMicrotask(()=>{callback(response);response.emit('data',JSON.stringify({error:{code:'ratelimited'}}));response.emit('end')});return new EventEmitter()}};
const context=vm.createContext({require:id=>id==='https'?https:realRequire(id),console:{log(){},warn(){},error(){}},process,__dirname:path.dirname(file),URL});
let source=fs.readFileSync(file,'utf8').split('(async () => {')[0].replace('const sleep = ms => new Promise(r => setTimeout(r, ms));','const sleep = async () => {};');vm.runInContext(source,context);
(async()=>{let rejected=false;for(let i=0;i<20;i++){try{await vm.runInContext('apiGet({})',context)}catch{rejected=true;break}}console.log(JSON.stringify({rejected,calls}));})().catch(e=>{console.error(e);process.exitCode=1});
""")
        self.assertTrue(value['rejected'])
        self.assertEqual(value['calls'], 140)
