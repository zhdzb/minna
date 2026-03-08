const LocalState = require('../src/utils/localState');

describe('LocalState Management', () => {
    beforeEach(() => {
        // Clear local storage before each test
        localStorage.clear();
        // Reset singleton instance if applicable or clear data
        LocalState.clearAll();
    });

    test('should initialize with default data if empty', () => {
        const data = LocalState.getData();
        expect(data.progress.current_lesson).toBe(1);
        expect(data.mistakes_book).toEqual([]);
        expect(data.collections).toEqual([]);
    });

    test('should save and retrieve progress correctly', () => {
        LocalState.updateProgress(5);
        const data = LocalState.getData();
        expect(data.progress.current_lesson).toBe(5);
        expect(data.progress.completed_lessons).toContain(4);
    });

    test('should add mistake to book', () => {
        const mistake = {
            lesson: 2,
            grammar_point: "助词を",
            user_wrong_input: "りんご が 食べます",
            correct_answer: "りんご を 食べます"
        };
        LocalState.addMistake(mistake);
        
        const data = LocalState.getData();
        expect(data.mistakes_book.length).toBe(1);
        expect(data.mistakes_book[0].lesson).toBe(2);
        expect(data.mistakes_book[0].id).toBeDefined(); // Should auto-generate ID
    });
});
