import { jest } from '@jest/globals';
import { getProjectContext, deps } from '../src/utils/context.js';

describe('getProjectContext', () => {
    const root = '/fake/project';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('identifies a Node.js project via package.json', async () => {
        jest.spyOn(deps.fs, 'existsSync').mockImplementation((p: any) => p.toString().endsWith('package.json'));
        jest.spyOn(deps.fs, 'readFileSync').mockReturnValue(JSON.stringify({
            name: 'test-project',
            description: 'A test project'
        }));
        jest.spyOn(deps.fs, 'readdirSync').mockReturnValue([] as any);
        jest.spyOn(deps, 'execSync').mockReturnValue(Buffer.from('https://github.com/test/repo') as any);

        const result = await getProjectContext(root);

        expect(result).toContain('Project Name: test-project');
        expect(result).toContain('Description: A test project');
        expect(result).toContain('Git Remote: https://github.com/test/repo');
    });

    test('identifies a software codebase via extension heuristic', async () => {
        jest.spyOn(deps.fs, 'existsSync').mockReturnValue(false);
        jest.spyOn(deps.fs, 'readdirSync').mockReturnValue(['index.ts', 'utils.ts', 'main.py', 'README.md'] as any);
        jest.spyOn(deps, 'execSync').mockImplementation(() => { throw new Error('no git'); });

        const result = await getProjectContext(root);

        expect(result).toContain('Context: Software codebase');
        expect(result).toContain('Primary Extensions: .ts, .py, .md');
    });

    test('identifies a document directory via extension heuristic', async () => {
        jest.spyOn(deps.fs, 'existsSync').mockReturnValue(false);
        jest.spyOn(deps.fs, 'readdirSync').mockReturnValue(['doc1.md', 'notes.txt', 'script.js'] as any);
        jest.spyOn(deps, 'execSync').mockImplementation(() => { throw new Error('no git'); });

        const result = await getProjectContext(root);

        expect(result).toContain('Context: Document/Writing directory');
    });
});
