/** "12 terms under K matching 'void'": the count line under the glossary filters (UI spec F5b.3). */
export function glossaryCount(
  total: number,
  noun: { singular: string; plural: string },
  letter: string | null,
  query: string,
): string {
  let text = `${total.toLocaleString('en-IN')} ${total === 1 ? noun.singular : noun.plural}`;
  if (letter) text += ` under ${letter}`;
  if (query) text += ` matching '${query}'`;
  return text;
}
