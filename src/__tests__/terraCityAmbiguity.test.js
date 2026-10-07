import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const entities = JSON.parse(readFileSync('src/data/geodb.json', 'utf8')).entities;
const questions = JSON.parse(readFileSync('public/data/questions_terra.json', 'utf8'));
const cities = Object.values(entities).filter(entity => entity.type === 'city');

describe('Geografisch eindeutige Stadtantworten', () => {
  it('bietet bei gleichnamigen Städten genau ein im Katalog belegtes Land an', () => {
    for (const question of questions.filter(q => q.type === 'city-match')) {
      const city = entities[question.entityId];
      const possible = new Set(cities.filter(other => other.name === city.name)
        .map(other => entities[other.metadata.countryId]?.name));
      expect(question.options.filter(option => possible.has(option)), question.id)
        .toEqual([question.correctAnswer]);
    }
  });
  it('bietet bei umgekehrten Fragen nur eine im Zielland belegte Stadt an', () => {
    for (const question of questions.filter(q => q.type === 'reverse-city-match')) {
      const names = new Set(cities.filter(city => city.metadata.countryId === question.mapTargetId)
        .map(city => city.name));
      expect(question.options.filter(option => names.has(option)), question.id)
        .toEqual([question.correctAnswer]);
    }
  });
});
