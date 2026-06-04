import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Quiz from '../components/Quiz';
import Map from '../components/Map';

// Mock audio utilities imported by Quiz
vi.mock('../utils/audio', () => ({
  playClick: vi.fn(),
  playCorrectChime: vi.fn(),
  playErrorBuzzer: vi.fn(),
  isAudioMuted: vi.fn(() => false),
  setAudioMuted: vi.fn()
}));

// Mock database utilities imported by Quiz
vi.mock('../utils/db', () => ({
  initDB: vi.fn(),
  getProgress: vi.fn(() => Promise.resolve(null)),
  getAllProgress: vi.fn(() => Promise.resolve([])),
  saveProgress: vi.fn(() => Promise.resolve()),
  addHistoryLog: vi.fn(() => Promise.resolve()),
  getHistoryLogs: vi.fn(() => Promise.resolve([])),
  saveSetting: vi.fn(() => Promise.resolve()),
  getSetting: vi.fn((key, defaultValue) => Promise.resolve(defaultValue)),
  clearAllData: vi.fn(() => Promise.resolve())
}));
// Mock database matching only the entities required for our test questions
const geodbMock = {
  entities: {
    city_FR_paris: {
      id: "city_FR_paris",
      type: "city",
      name: "Paris",
      metadata: {
        countryId: "FR",
        isCapital: true
      }
    },
    river_seine: {
      id: "river_seine",
      type: "river",
      name: "Seine",
      metadata: {
        countries: ["FR"]
      }
    },
    FR: {
      id: "FR",
      type: "country",
      name: "Frankreich"
    }
  }
};

// Mock specific test questions catalog
vi.mock('../data/quiz_questions.json', () => {
  return {
    default: [
      {
        id: "q_city_FR_paris_river",
        entityId: "city_FR_paris",
        entityType: "city",
        type: "city-river",
        difficulty: 1,
        prompt: "Welcher Fluss fließt direkt durch die Stadt Paris?",
        correctAnswer: "Seine",
        options: ["Amazonas", "Ebro", "Seine", "Tigris"],
        silhouetteSvgPath: null,
        mapTargetId: "FR"
      },
      {
        id: "q_country_FR_click",
        entityId: "FR",
        entityType: "country",
        type: "click-map",
        difficulty: 1,
        prompt: "Klicke auf Frankreich!",
        correctAnswer: "Frankreich",
        options: [],
        silhouetteSvgPath: null,
        mapTargetId: "FR"
      }
    ]
  };
});

// Stable array references to prevent infinite React rendering loop in test environment
const dueEntitiesMock = [];
const newEntitiesMock = Object.values(geodbMock.entities);

// Test component integrating Quiz & Map using matching state bridges
function QuizMapTestWrapper({ quizMode = 'all', difficulty = 1, onFinished = () => {} }) {
  const [mapState, setMapState] = useState({
    mode: 'dashboard',
    highlightedIds: [],
    correctIds: [],
    wrongIds: [],
    showSubdivisions: false,
    zoomToEntityId: null
  });
  
  const [clickedMapId, setClickedMapId] = useState(null);
  const [score, setScore] = useState(0);

  return (
    <div style={{ display: 'flex', height: '500px' }}>
      <div data-testid="map-state">
        {JSON.stringify(mapState)}
      </div>
      <Map 
        selectedId={null}
        onSelectEntity={setClickedMapId}
        highlightedIds={mapState.highlightedIds}
        correctIds={mapState.correctIds}
        wrongIds={mapState.wrongIds}
        progressHeatmap={{}}
        mode={mapState.mode}
        showSubdivisions={mapState.showSubdivisions}
        zoomToEntityId={mapState.zoomToEntityId}
      />
      <Quiz 
        geodb={geodbMock}
        dueEntities={dueEntitiesMock}
        newEntities={newEntitiesMock}
        difficulty={difficulty}
        quizMode={quizMode}
        clickedMapId={clickedMapId}
        resetClickedMapId={() => setClickedMapId(null)}
        onQuizFinished={onFinished}
        onSetQuizState={setMapState}
        onAddScore={(points) => setScore(prev => prev + points)}
      />
    </div>
  );
}

describe('Quiz & Map Integration Test', () => {
  it('loads the components, clicks the correct option for city-river question, renders "Weiter" without errors, and transitions to next question', async () => {
    // Spy on console.error to ensure no React rendering or styling errors occur
    const consoleErrorSpy = vi.spyOn(console, 'error');
    // Mock Math.random to make question sorting deterministic (Paris question will come first)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    render(<QuizMapTestWrapper />);

    // 1. Check prompt rendering
    expect(screen.getByText('Welcher Fluss fließt direkt durch die Stadt Paris?')).toBeInTheDocument();

    // 2. Locate Seine option and click it
    const seineBtn = screen.getByRole('button', { name: /Seine/i });
    expect(seineBtn).toBeInTheDocument();
    
    // Check initial state of the button (not answered)
    expect(seineBtn).not.toHaveStyle('color: var(--color-success)');

    // Click option
    fireEvent.click(seineBtn);

    // 3. Check for correct state updates and button highlighting
    await waitFor(() => {
      expect(seineBtn).toBeDisabled();
    });

    // Check that console.error was not called during this action
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // 4. Verify "Weiter" button is rendered
    const nextBtn = screen.getByRole('button', { name: /Weiter/i });
    expect(nextBtn).toBeInTheDocument();

    // Verify mapState output div contains correctIds: ["FR", "river_seine"]
    const mapStateDiv = screen.getByTestId('map-state');
    expect(mapStateDiv.textContent).toContain('"correctIds":["FR","river_seine"]');

    // 5. Click "Weiter" to proceed
    fireEvent.click(nextBtn);

    // 6. Verify transition to click-map question
    expect(screen.getByText('Klicke auf Frankreich!')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('handles wrong answers correctly on city-river questions without throwing and maps correctIds/wrongIds properly', async () => {
    // Mock Math.random to make question sorting deterministic (Paris question will come first)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    render(<QuizMapTestWrapper />);

    // Locate Ebro option (wrong answer) and click it
    const ebroBtn = screen.getByRole('button', { name: /Ebro/i });
    expect(ebroBtn).toBeInTheDocument();

    fireEvent.click(ebroBtn);

    // Verify button is disabled
    await waitFor(() => {
      expect(ebroBtn).toBeDisabled();
    });

    // Verify mapState output div contains wrongIds: ["FR", "river_seine"]
    const mapStateDiv = screen.getByTestId('map-state');
    expect(mapStateDiv.textContent).toContain('"wrongIds":["FR","river_seine"]');

    // Verify "Weiter" button is visible
    expect(screen.getByRole('button', { name: /Weiter/i })).toBeInTheDocument();

    randomSpy.mockRestore();
  });
});
