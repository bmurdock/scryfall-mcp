import { ConceptMapping } from '../types.js';

export function buildBaseQuery(mappings: ConceptMapping[]): string {
  const queryParts: string[] = [];
  const grouped = groupMappingsByOperator(mappings);

  for (const [operator, operatorMappings] of grouped) {
    const part = buildOperatorQuery(operator, operatorMappings);
    if (part) {
      queryParts.push(part);
    }
  }

  return queryParts.join(' ');
}

function groupMappingsByOperator(mappings: ConceptMapping[]): Map<string, ConceptMapping[]> {
  const grouped = new Map<string, ConceptMapping[]>();

  for (const mapping of mappings) {
    const key = mapping.operator;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(mapping);
  }

  return grouped;
}

function buildOperatorQuery(operator: string, mappings: ConceptMapping[]): string {
  if (mappings.length === 0) return '';

  if (mappings.length === 1) {
    const mapping = mappings[0];
    const prefix = mapping.negation ? '-' : '';
    const comparison = mapping.comparison || '';
    return `${prefix}${operator}:${comparison}${mapping.value}`;
  }

  if (operator === 'o') {
    const values = mappings.map(m => m.value);
    return `(${values.map(value => `o:"${value}"`).join(' OR ')})`;
  }

  if (operator === 't') {
    const values = mappings.map(m => m.value);
    return `(${values.map(value => `t:${value}`).join(' OR ')})`;
  }

  if (['cmc', 'pow', 'tou', 'usd', 'eur', 'tix'].includes(operator)) {
    return buildNumericRange(operator, mappings);
  }

  const best = mappings.reduce((a, b) => (a.confidence > b.confidence ? a : b), mappings[0]);
  const prefix = best.negation ? '-' : '';
  const comparison = best.comparison || '';
  return `${prefix}${operator}:${comparison}${best.value}`;
}

function buildNumericRange(operator: string, mappings: ConceptMapping[]): string {
  const minMappings = mappings.filter(m => m.comparison === '>=' || m.comparison === '>');
  const maxMappings = mappings.filter(m => m.comparison === '<=' || m.comparison === '<');
  const exactMappings = mappings.filter(m => !m.comparison || m.comparison === '=');

  if (exactMappings.length > 0) {
    const best = exactMappings.reduce((a, b) => (a.confidence > b.confidence ? a : b), exactMappings[0]);
    return `${operator}:${best.value}`;
  }

  const parts: string[] = [];

  if (minMappings.length > 0) {
    const best = minMappings.reduce((a, b) => (a.confidence > b.confidence ? a : b), minMappings[0]);
    parts.push(`${operator}:${best.comparison}${best.value}`);
  }

  if (maxMappings.length > 0) {
    const best = maxMappings.reduce((a, b) => (a.confidence > b.confidence ? a : b), maxMappings[0]);
    parts.push(`${operator}:${best.comparison}${best.value}`);
  }

  return parts.join(' ');
}

export function applyFormat(query: string, format?: string): string {
  if (!format) return query;
  const formatPart = `f:${format}`;
  return query ? `${query} ${formatPart}` : formatPart;
}
