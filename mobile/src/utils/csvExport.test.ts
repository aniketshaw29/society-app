// ---------------------------------------------------------------------------
// csvExport.test.ts
// ---------------------------------------------------------------------------

import { objectsToCsv } from '../utils/csvExport';

describe('objectsToCsv', () => {
  it('produces valid CSV with header row from first object keys', () => {
    const data = [
      { name: 'Alice', age: 30, city: 'Mumbai' },
      { name: 'Bob', age: 25, city: 'Delhi' },
    ];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('name,age,city');
    expect(lines[1]).toBe('Alice,30,Mumbai');
    expect(lines[2]).toBe('Bob,25,Delhi');
  });

  it('single row produces 2-line output (header + data)', () => {
    const data = [{ id: '1', status: 'active' }];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('id,status');
    expect(lines[1]).toBe('1,active');
  });

  it('values with commas are wrapped in double quotes', () => {
    const data = [{ address: '123, Main Street', name: 'Test' }];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"123, Main Street",Test');
  });

  it('null values render as empty string', () => {
    const data = [{ name: 'Alice', phone: null, email: undefined }];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    // phone and email should be empty
    expect(lines[1]).toBe('Alice,,');
  });

  it('values with double quotes are escaped as ""', () => {
    const data = [{ desc: 'He said "hello"', name: 'Bob' }];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"He said ""hello""",Bob');
  });

  it('values with newlines are wrapped in double quotes', () => {
    const data = [{ notes: 'line1\nline2', id: '42' }];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    // First data "line" will be quoted and span multiple CSV lines, but the
    // first line must start with a quote
    expect(lines[1]!.startsWith('"')).toBe(true);
  });

  it('returns empty string for empty array', () => {
    expect(objectsToCsv([])).toBe('');
  });

  it('handles numeric and boolean values', () => {
    const data = [{ count: 42, active: true, score: 3.14 }];
    const csv = objectsToCsv(data);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('count,active,score');
    expect(lines[1]).toBe('42,true,3.14');
  });
});
