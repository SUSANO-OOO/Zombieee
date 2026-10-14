import assert from 'node:assert/strict';
import test from 'node:test';
import {V080_UNIT_VISUAL_PROFILES, EVENT_PORTRAIT_PROFILES} from '../app/visualProfiles.js';
import {FORMATION_CARD_ART, PERSONNEL_CARD_ART} from '../app/spriteManifest.js';
import {V100_EVENT_EXPRESSIONS, v100EventPortraitPath} from '../app/v100StoryDirection.js';

test('Paisen uses the producer-photo identity across formation, personnel and dialogue surfaces', () => {
  const profile = V080_UNIT_VISUAL_PROFILES.brawler;
  assert.equal(profile.unitId, 'unit-paisen');
  assert.equal(profile.identityMaster.path, '/art/v100/portraits/paisen-identity-r2.webp');
  assert.equal(profile.identityMaster.revision, 'producer-photos-20261015-r2');
  assert.equal(profile.eventPortrait.path, '/art/v100/portraits/paisen-event-portrait-r2.webp');
  assert.equal(EVENT_PORTRAIT_PROFILES.brawler.path, profile.eventPortrait.path);
  assert.equal(FORMATION_CARD_ART.brawler, '/art/v100/portraits/paisen-formation-card-r3.webp');
  assert.equal(PERSONNEL_CARD_ART.brawler, FORMATION_CARD_ART.brawler);
});

test('Every Paisen expression resolves to the new identity, with other characters and invalid owners preserved', () => {
  for(const expression of V100_EVENT_EXPRESSIONS) {
    assert.equal(v100EventPortraitPath('unit-paisen', expression), `/art/v100/portraits/paisen-${expression}-r2.webp`);
    assert.equal(v100EventPortraitPath('unit-kumaverson', expression), `/art/v100/story-r5/portraits/kumaverson-${expression}.webp`);
  }
  assert.equal(v100EventPortraitPath('unit-paisen', 'invalid'), null);
  assert.equal(v100EventPortraitPath('unknown', 'warm'), null);
});
