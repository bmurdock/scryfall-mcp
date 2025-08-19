import { ScryfallCard, ScryfallSet, ScryfallSearchResponse, Legalities } from '../types/scryfall-api.js';
import { FormattedCard, FormattedSearchResult, FormattedSet } from '../types/mcp-types.js';

/**
 * Formats a Scryfall card for MCP response
 */
export function formatCard(card: ScryfallCard, includeImage = true): FormattedCard {
  // Handle multi-faced cards
  const mainFace = card.card_faces?.[0] || card;
  const name = card.card_faces ? `${card.card_faces[0].name} // ${card.card_faces[1].name}` : card.name;
  
  return {
    name,
    mana_cost: mainFace.mana_cost || card.mana_cost,
    type_line: mainFace.type_line || card.type_line,
    oracle_text: formatOracleText(card),
    power: mainFace.power || card.power,
    toughness: mainFace.toughness || card.toughness,
    set_name: card.set_name,
    rarity: card.rarity,
    prices: {
      usd: card.prices.usd,
      eur: card.prices.eur,
      tix: card.prices.tix
    },
    legalities: formatLegalities(card.legalities),
    image_url: includeImage ? getCardImageUrl(card) : undefined,
    color_identity: card.color_identity,
    games: card.games
  };
}

/**
 * Formats oracle text for multi-faced cards
 */
function formatOracleText(card: ScryfallCard): string | undefined {
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces
      .map((face, index) => {
        const faceLabel = index === 0 ? 'Front' : 'Back';
        return `${faceLabel}: ${face.oracle_text || '(No text)'}`;
      })
      .join('\n\n');
  }
  return card.oracle_text;
}

/**
 * Gets the appropriate image URL for a card
 */
function getCardImageUrl(card: ScryfallCard): string | undefined {
  // Prefer card-level image, fall back to first face
  const imageUris = card.image_uris || card.card_faces?.[0]?.image_uris;
  return imageUris?.normal;
}

/**
 * Formats legalities object to a more readable format
 */
function formatLegalities(legalities: Legalities): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  // Only include formats where the card is legal or restricted
  Object.entries(legalities).forEach(([format, legality]) => {
    if (legality === 'legal' || legality === 'restricted') {
      formatted[format] = legality;
    }
  });
  
  return formatted;
}

/**
 * Formats search results for text display
 */
export function formatSearchResultsAsText(
  searchResponse: ScryfallSearchResponse,
  currentPage = 1,
  pageSize = 20
): string {
  const { total_cards, has_more, data: cards, warnings } = searchResponse;
  const displayed = Array.isArray(cards) ? cards.slice(0, Math.max(0, pageSize)) : [];
  
  let result = `Found ${total_cards ?? cards.length} card${(total_cards ?? cards.length) !== 1 ? 's' : ''}`;
  
  if (has_more && total_cards) {
    const totalPages = Math.ceil(total_cards / pageSize);
    result += ` (Page ${currentPage} of ${totalPages})`;
  }
  
  result += ':\n\n';
  
  // Add warnings if present
  if (warnings && warnings.length > 0) {
    result += '⚠️  **Warnings:**\n';
    warnings.forEach(warning => {
      result += `- ${warning}\n`;
    });
    result += '\n';
  }
  
  displayed.forEach((card, index) => {
    const cardNumber = (currentPage - 1) * pageSize + index + 1;
    result += formatCardAsText(card, cardNumber);
    result += '\n';
  });
  
  if (has_more || (total_cards && total_cards > currentPage * pageSize)) {
    const remainingCount = total_cards ? Math.max(0, total_cards - currentPage * pageSize) : 'many';
    result += `\n... and ${remainingCount} more cards. Use page parameter to see more results.`;
  }
  
  return result;
}

/**
 * Formats a single card for text display
 */
function formatCardAsText(card: ScryfallCard, index?: number): string {
  const formatted = formatCard(card, false);
  let result = '';
  
  if (index) {
    result += `${index}. `;
  }
  
  result += `**${formatted.name}**`;
  
  if (formatted.mana_cost) {
    result += ` ${formatted.mana_cost}`;
  }
  
  result += `\n   ${formatted.type_line}`;
  
  if (formatted.power && formatted.toughness) {
    result += ` (${formatted.power}/${formatted.toughness})`;
  }
  
  result += `\n   *${formatted.set_name}* - ${formatted.rarity}`;
  
  if (formatted.prices.usd) {
    result += ` - $${formatted.prices.usd}`;
  }
  
  if (formatted.oracle_text) {
    // Truncate long oracle text for list view
    const truncatedText = formatted.oracle_text.length > 100 
      ? formatted.oracle_text.substring(0, 100) + '...'
      : formatted.oracle_text;
    result += `\n   ${truncatedText}`;
  }
  
  return result;
}

/**
 * Formats search results for JSON display
 */
export function formatSearchResultsAsJson(
  searchResponse: ScryfallSearchResponse,
  currentPage = 1,
  pageSize = 20
): FormattedSearchResult {
  const { total_cards, has_more, data: cards, warnings } = searchResponse;
  const displayed = Array.isArray(cards) ? cards.slice(0, Math.max(0, pageSize)) : [];
  const totalPages = total_cards ? Math.ceil(total_cards / pageSize) : undefined;
  
  return {
    total_cards: total_cards ?? cards.length,
    has_more,
    cards: displayed.map(card => formatCard(card)),
    warnings,
    page_info: {
      current_page: currentPage,
      total_pages: totalPages,
      next_page: has_more ? `page=${currentPage + 1}` : undefined
    }
  };
}

/**
 * Formats a single card for detailed display
 */
export function formatCardDetails(card: ScryfallCard, includeImage = true): string {
  const formatted = formatCard(card, includeImage);
  
  let result = `# ${formatted.name}\n\n`;
  
  if (formatted.mana_cost) {
    result += `**Mana Cost:** ${formatted.mana_cost}\n`;
  }
  
  result += `**Type:** ${formatted.type_line}\n`;
  
  if (formatted.power && formatted.toughness) {
    result += `**Power/Toughness:** ${formatted.power}/${formatted.toughness}\n`;
  }
  
  if (formatted.oracle_text) {
    result += `\n**Oracle Text:**\n${formatted.oracle_text}\n`;
  }
  
  result += `\n**Set:** ${formatted.set_name}\n`;
  result += `**Rarity:** ${formatted.rarity}\n`;
  
  // Prices
  const prices = Object.entries(formatted.prices)
    .filter(([, price]) => price)
    .map(([currency, price]) => `${currency.toUpperCase()}: $${price}`)
    .join(', ');
  
  if (prices) {
    result += `**Prices:** ${prices}\n`;
  }
  
  // Legalities
  const legalFormats = Object.entries(formatted.legalities)
    .map(([format, legality]) => `${format}: ${legality}`)
    .join(', ');
  
  if (legalFormats) {
    result += `**Legal in:** ${legalFormats}\n`;
  }
  
  if (formatted.image_url) {
    result += `\n**Image:** ${formatted.image_url}\n`;
  }
  
  return result;
}

/**
 * Formats a Scryfall set for MCP response
 */
export function formatSet(set: ScryfallSet): FormattedSet {
  return {
    name: set.name,
    code: set.code,
    type: set.set_type,
    released_at: set.released_at,
    card_count: set.card_count,
    digital: set.digital,
    icon_url: set.icon_svg_uri
  };
}

/**
 * Formats sets for text display
 */
export function formatSetsAsText(sets: ScryfallSet[]): string {
  if (sets.length === 0) {
    return 'No sets found.';
  }
  
  let result = `Found ${sets.length} set${sets.length !== 1 ? 's' : ''}:\n\n`;
  
  sets.forEach((set, index) => {
    result += `${index + 1}. **${set.name}** (${set.code.toUpperCase()})\n`;
    result += `   Type: ${set.set_type}`;
    
    if (set.released_at) {
      result += ` | Released: ${set.released_at}`;
    }
    
    result += ` | Cards: ${set.card_count}`;
    
    if (set.digital) {
      result += ' | Digital';
    }
    
    result += '\n\n';
  });
  
  return result;
}

/**
 * Formats card prices for display
 */
export function formatCardPrices(card: ScryfallCard, currency = 'usd'): string {
  let result = `# Prices for ${card.name}\n\n`;
  
  const prices = card.prices;
  
  if (currency === 'usd') {
    if (prices.usd) result += `**Paper:** $${prices.usd}\n`;
    if (prices.usd_foil) result += `**Foil:** $${prices.usd_foil}\n`;
    if (prices.usd_etched) result += `**Etched:** $${prices.usd_etched}\n`;
  } else if (currency === 'eur') {
    if (prices.eur) result += `**Paper:** €${prices.eur}\n`;
    if (prices.eur_foil) result += `**Foil:** €${prices.eur_foil}\n`;
  } else if (currency === 'tix') {
    if (prices.tix) result += `**MTGO:** ${prices.tix} tix\n`;
  }
  
  if (result === `# Prices for ${card.name}\n\n`) {
    result += 'No price data available for this currency.';
  }
  
  return result;
}
