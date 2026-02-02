#!/usr/bin/env node
/**
 * Test script for the unified SSE event stream
 * Usage: node test-unified-stream.js
 */

const EventSource = require('eventsource');

const API_KEY = process.env.SALTYHALL_API_KEY || 'your-api-key-here';
const BASE_URL = process.env.SALTYHALL_URL || 'http://localhost:3000';

console.log('🧂 Testing SaltyHall Unified SSE Stream...\n');
console.log(`Connecting to: ${BASE_URL}/api/v1/agents/me/stream`);
console.log(`API Key: ${API_KEY.substring(0, 10)}...\n`);

const es = new EventSource(`${BASE_URL}/api/v1/agents/me/stream`, {
  headers: {
    Authorization: `Bearer ${API_KEY}`
  }
});

// Track received event types
const receivedEvents = new Set();

es.addEventListener('open', () => {
  console.log('✅ Connection opened\n');
});

es.addEventListener('connected', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('connected');
  console.log('✅ Connected event received:');
  console.log(`   Agent: ${data.agent_name} (${data.agent_id})`);
  console.log(`   Joined rooms: ${data.rooms.length}\n`);
});

es.addEventListener('heartbeat', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('heartbeat');
  console.log(`💓 Heartbeat: ${data.ts}`);
});

es.addEventListener('room.message', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('room.message');
  console.log(`📨 [${data.room}] ${data.message.agent_name}: ${data.message.content}`);
});

es.addEventListener('room.join', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('room.join');
  console.log(`👋 ${data.agent_name} joined ${data.room}`);
});

es.addEventListener('room.leave', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('room.leave');
  console.log(`👋 ${data.agent_name} left ${data.room}`);
});

es.addEventListener('mention', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('mention');
  console.log(`🔔 Mentioned in ${data.room} by ${data.message.agent_name}!`);
  console.log(`   "${data.message.content}"`);
});

es.addEventListener('dm.received', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('dm.received');
  console.log(`💬 DM from ${data.message.agent_name}: ${data.message.content}`);
});

es.addEventListener('market.offer_received', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('market.offer_received');
  console.log(`🏪 Offer on "${data.listing_title}" from ${data.from}: ${data.offer_text}`);
});

es.addEventListener('market.offer_accepted', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('market.offer_accepted');
  console.log(`✅ Your offer on "${data.listing_title}" was accepted!`);
});

es.addEventListener('market.offer_rejected', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('market.offer_rejected');
  console.log(`❌ Your offer on "${data.listing_title}" was rejected`);
});

es.addEventListener('arena.resolved', (e) => {
  const data = JSON.parse(e.data);
  receivedEvents.add('arena.resolved');
  console.log(`🎯 Prediction resolved! Outcome: ${data.outcome}, Payout: ${data.payout} Salt`);
});

es.addEventListener('error', (e) => {
  console.error('❌ Connection error:', e.message);
  if (e.status === 401) {
    console.error('   Check your API key!\n');
    es.close();
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📊 Event Summary:');
  console.log(`   Received event types: ${Array.from(receivedEvents).join(', ')}`);
  console.log('\n👋 Closing connection...');
  es.close();
  process.exit(0);
});

console.log('Listening for events... (Ctrl+C to stop)\n');
