const {
  calculateDueDate,
  isSlaBreached,
} = require('../src/utils/sla');

describe('SLA helper', () => {
  const createdAt = new Date('2026-10-19T12:00:00.000Z');

  test.each([
    ['High', 4],
    ['Medium', 24],
    ['Low', 72],
  ])('%s priority has a %i-hour deadline', (priority, hours) => {
    const dueAt = calculateDueDate(priority, createdAt);

    expect(dueAt.getTime() - createdAt.getTime()).toBe(
      hours * 60 * 60 * 1000
    );
  });

  test('rejects an invalid priority', () => {
    expect(() => calculateDueDate('Urgent', createdAt))
      .toThrow('Invalid ticket priority: Urgent');
  });

  test('flags an unresolved ticket after its deadline', () => {
    expect(isSlaBreached({
      status: 'Open',
      due_at: '2026-10-19T16:00:00.000Z',
      resolved_at: null,
    }, new Date('2026-10-19T16:01:00.000Z'))).toBe(true);
  });

  test('does not flag a ticket before its deadline', () => {
    expect(isSlaBreached({
      status: 'Open',
      due_at: '2026-10-19T16:00:00.000Z',
      resolved_at: null,
    }, new Date('2026-10-19T15:59:00.000Z'))).toBe(false);
  });

  test.each(['Resolved', 'Closed'])(
    'does not flag a %s ticket as breached',
    (status) => {
      expect(isSlaBreached({
        status,
        due_at: '2026-10-19T16:00:00.000Z',
        resolved_at: '2026-10-19T15:00:00.000Z',
      }, new Date('2026-10-19T17:00:00.000Z'))).toBe(false);
    }
  );
});
