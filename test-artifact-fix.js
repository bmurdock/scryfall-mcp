#!/usr/bin/env node

// Test script to verify artifact theme fixes
import { ScryfallMCPServer } from './dist/server.js';

async function testArtifactFix() {
  console.log('Testing artifact theme refinements...');
  
  const server = new ScryfallMCPServer();
  const tool = server.tools?.get('find_synergistic_cards');
  
  if (!tool) {
    console.error('Tool not found!');
    return;
  }

  console.log('\n=== Testing artifact theme (should now work) ===');
  try {
    const result = await tool.execute({
      focus_card: 'artifact',
      synergy_type: 'theme',
      limit: 3
    });
    
    const success = !result.isError && !result.content[0].text.includes('No synergistic cards found');
    console.log(`✅ Success: ${success}`);
    
    if (success) {
      console.log('First few cards found:');
      const lines = result.content[0].text.split('\n').slice(0, 8);
      lines.forEach(line => {
        if (line.includes('**') && !line.includes('Synergistic cards')) {
          console.log(`   ${line.trim()}`);
        }
      });
    } else {
      console.log('❌ Still failing - result:');
      console.log(result.content[0].text.substring(0, 200));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n=== Test complete ===');
}

testArtifactFix().catch(console.error);