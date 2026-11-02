// Offline sample. "Northwind Robotics" is a FICTIONAL company; nothing here is real news.
// It runs through the real verify() so the demo shows the safeguards working.
const d = n => new Date(Date.now() - n * 864e5).toISOString();
export const sampleSources = () => [
  { id: 'S1', title: 'Northwind Robotics raises $32M Series B led by Harbor Capital', date: d(4), dated: true, url: 'https://example.com/sample/northwind-series-b', content: 'Northwind Robotics announced a $32M Series B led by Harbor Capital to expand warehouse automation.' },
  { id: 'S2', title: 'Northwind launches Atlas Picker 2 for mixed-case picking', date: d(11), dated: true, url: 'https://example.com/sample/atlas-picker-2', content: 'The Atlas Picker 2 handles mixed-case picking and ships to early customers in the second quarter.' },
  { id: 'S3', title: 'Northwind names Dana Reyes chief revenue officer', date: d(16), dated: true, url: 'https://example.com/sample/new-cro', content: 'Dana Reyes joins Northwind as chief revenue officer, previously at a logistics software firm.' },
  { id: 'S4', title: 'Northwind and Contoso Logistics announce pilot partnership', date: d(22), dated: true, url: 'https://example.com/sample/contoso-pilot', content: 'Contoso Logistics will pilot Northwind robots across two distribution centers.' },
  { id: 'S5', title: 'Northwind careers and company update', date: null, dated: false, url: 'https://example.com/sample/company-update', content: 'General company page listing open roles in engineering and field operations.' },
];
export const sampleRaw = {
  summary: 'Northwind Robotics is in a growth phase: fresh Series B funding, a new picking product, and a new revenue leader. Contoso is an early partnership signal.',
  developments: [
    { claim: 'Northwind raised a $32M Series B led by Harbor Capital.', category: 'funding', date: null, sources: ['S1'] },
    { claim: 'Northwind launched Atlas Picker 2 for mixed-case picking.', category: 'launch', date: null, sources: ['S2'] },
    { claim: 'Dana Reyes joined as chief revenue officer.', category: 'hire', date: null, sources: ['S3'] },
    { claim: 'Contoso Logistics will pilot Northwind robots in two distribution centers.', category: 'partnership', date: null, sources: ['S4'] },
    { claim: 'Northwind acquired a European competitor.', category: 'other', date: null, sources: [] },
    { claim: 'Northwind raised a $50M Series B.', category: 'funding', date: null, sources: ['S1'] },
  ],
  open_questions: ['What will the Series B fund first: product, hiring, or new regions?', 'What would Contoso need to see to move from pilot to rollout?', 'How will the new CRO change how Northwind sells?'],
  conversation_starters: [{ text: 'Congratulations on the Series B. What is the first thing the money unlocks?', basis: ['S1'] }, { text: 'How are early Atlas Picker 2 customers responding to mixed-case picking?', basis: ['S2'] }],
  gaps: [],
};
