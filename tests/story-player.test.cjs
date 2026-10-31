const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const stories = require('../assets/story-scripts.js');
const people = require('../assets/story-characters.js');
const player = require('../assets/story-player.js');
const feedback = require('../assets/public-feedback.js');

test('all six stories require a choice, retain distinct consequences, and reset on another job', () => {
  assert.equal(stories.episodes.length, 6);
  assert.equal(Object.keys(stories.cast).length, 8);
  stories.episodes.forEach((episode, index) => {
    assert.equal(episode.scenes.length, 5);
    let state = player.initial(index);
    state = player.transition(state, {type:'next'});
    state = player.transition(state, {type:'play'});
    state = player.transition(state, {type:'tick'});
    assert.equal(state.scene, 2); assert.equal(state.playing, false);
    assert.equal(player.transition(state, {type:'next'}).scene, 2);
    assert.equal(player.transition(state, {type:'play'}).playing, false);
    const endings = [];
    for (const branch of ['within','breach']) {
      let path = player.transition(state, {type:'branch',value:branch});
      assert.equal(player.view(path).narration, branch==='within'?episode.rule.allowed:episode.rule.blocked);
      path = player.transition(path, {type:'next'});
      assert.equal(player.view(path).narration, episode.outcomes[branch].intervention);
      path = player.transition(path, {type:'next'});
      endings.push(player.view(path).narration);
      assert.equal(player.view(path).narration, episode.outcomes[branch].consequence);
      assert.deepEqual(player.transition(path,{type:'next'}),player.initial(index));
      assert.deepEqual(player.transition(path,{type:'episode',index:(index+1)%6}),player.initial((index+1)%6));
    }
    assert.notEqual(endings[0],endings[1]);
  });
});

test('backtracking before the decision removes a previous choice; invalid branch cannot select an outcome', () => {
  let state = {...player.initial(),scene:3,branch:'breach'};
  state=player.transition(state,{type:'previous'});
  assert.equal(state.branch,'breach');
  state=player.transition(state,{type:'previous'});
  assert.equal(state.branch,null);
  assert.equal(player.view(state).outcome,null);
  state=player.transition(state,{type:'branch',value:'breach'});
  assert.equal(state.branch,null);
  assert.equal(player.transition({...state,scene:2},{type:'branch',value:'<script>'}).branch,null);
});

test('the whole cast has visible facial and hand changes without accepting injected markup', () => {
  const all = new Set();
  for(const id of Object.keys(stories.cast)) {
    assert.ok(people.byId[id]);
    for(const pose of people.poses) for(const side of ['left','right']) {
      const svg=people.render(id,pose,side,'trial');
      assert.match(svg,/viewBox="0 0 240 360"/);
      assert.match(svg,/head-motion/); assert.match(svg,/gesture-motion/); assert.match(svg,/body-motion/);
      assert.ok(!svg.includes('<script'));all.add(svg);
    }
    const happy=people.render(id,'happy','left','same').replace(/aapsame[a-z]+\d+/g,'ID');
    const worried=people.render(id,'worried','left','same').replace(/aapsame[a-z]+\d+/g,'ID');
    assert.notEqual(happy,worried);
  }
  assert.equal(all.size,128);
  const hostile=people.render('<script>alert(1)</script>','" onload="alert(1)','evil','"><script>');
  assert.ok(!hostile.includes('<script'));assert.ok(!hostile.includes('onload='));
});

test('stories and feedback contain no transport, credential or persistence operations', () => {
  for(const file of ['story-player.js','story-scripts.js','story-characters.js','public-feedback.js']) {
    const source=fs.readFileSync(require.resolve('../assets/'+file),'utf8');
    assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\s*[.(]/);
  }
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  assert.match(html,/Fictional, interactive illustration/);
  assert.match(html,/sandbox\/index\.html/);
  assert.match(html,/docs\/TRIAL\.html/);
});

test('feedback is a reviewable email draft, with fixed recipient and safely encoded body', () => {
  const result=feedback.prepare('Connecting an agent','Example only: <script> &bcc=someone@example.com\nWhere is my token?');
  assert.ok(result.email.startsWith('mailto:jupitersstring@gmail.com?'));
  const query=new URLSearchParams(result.email.split('?')[1]);
  assert.deepEqual([...query.keys()],['subject','body']);
  assert.match(query.get('body'),/Where is my token/);
  assert.match(result.text,/Page: https:\/\/covenant-common.github.io\/covenant-docs\//);
  assert.throws(()=>feedback.prepare('bad recipient','hello'));
  assert.throws(()=>feedback.prepare('Connecting an agent','  '));
  assert.throws(()=>feedback.prepare('Connecting an agent','x'.repeat(1201)));
});
