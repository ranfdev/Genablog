// Start: Adapted from https://github.com/bodil/gx/blob/master/packages/core/jsx.ts
export const MoveType = {
  Remove: 0,
  Insert: 1,
};

export function diff(oldList, newList) {
  const oldIndex = new Set(oldList);
  const newIndex = new Set(newList);
  const moves = [];
  const simulateList = [];

  function insert(index, item) {
    moves.push({
      type: MoveType.Insert,
      after: newList[index - 1] ?? null,
      item,
    });
  }

  oldList.forEach((item) => {
    if (!item) {
      return;
    }
    if (newIndex.has(item)) {
      simulateList.push(item);
    } else {
      moves.push({ type: MoveType.Remove, item });
    }
  });

  for (let i = 0, j = 0; i < newList.length; i++) {
    const item = newList[i];
    const simulateItem = simulateList[j];
    if (Object.is(item, simulateItem)) {
      j++;
    } else if (!oldIndex.has(item)) {
      insert(i, item);
    } else {
      const nextItem = simulateList[j + 1];
      if (Object.is(nextItem, item)) {
        simulateList.splice(j, 1);
        j++;
      } else {
        insert(i, item);
      }
    }
  }

  return moves;
}
// End: Adapted from
