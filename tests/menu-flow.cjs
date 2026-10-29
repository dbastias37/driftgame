const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const visible=id=>`!$('#${id}').classList.contains('hidden')`;
test('race and time trial choose the circuit before the garage and retain the exact track',()=>{
 for(const entry of ['btnQuickRace','btnModeTT']){
  const r=harness();r(`$('#${entry}').click()`);assert.equal(r(visible('circuitMenu')),true);assert.equal(r(visible('carPanel')),false);
  r('previewCircuit(17);confirmTrackPreview()');assert.equal(r(visible('carPanel')),true);assert.equal(r('preparedTrack.layout.level'),17);
  r("carIdx=2;updatePanel();$('#btnCarBack').click()");assert.equal(r(visible('circuitMenu')),true);assert.equal(r('previewSelection.level'),17);
  r("confirmTrackPreview();$('#btnChooseStart').click()");assert.equal(r('state'),'countdown');assert.equal(r('track===preparedTrack'),true);assert.equal(r('chosen.sprite'),'yellow');assert.equal(r('mode'),entry==='btnModeTT'?'tt':'race');
 }
});
test('locked challenges can be previewed but cannot open the garage or start a race',()=>{
 const r=harness();r("$('#btnModeChallenge').click();previewCircuit(20,true)");assert.equal(r(visible('challengeMenu')),true);assert.equal(r("$('#btnChallengeContinue').disabled"),true);
 r('confirmTrackPreview()');assert.equal(r(visible('carPanel')),false);assert.equal(r('player'),null);
 r('previewCircuit(1,true);confirmTrackPreview()');assert.equal(r(visible('carPanel')),true);assert.equal(r('activeChallengeLevel'),1);
 r("$('#btnChooseStart').click();state='running';player.score=activeChallengeGoal;checkChallengeProgress();$('#btnNextChallenge').click()");
 assert.equal(r(visible('challengeMenu')),true);assert.equal(r('previewSelection.level'),2);assert.equal(r(visible('carPanel')),false);
});
test('editor and import previews preserve geometry, origin, and selected car on back navigation',()=>{
 for(const origin of ['board','import']){
  const r=harness();r(`var custom=presetTrack(4);delete custom.layout;var original=JSON.stringify(custom);showCustomTrackPreview(custom,'${origin}');confirmTrackPreview();`);
  assert.equal(r('preparedTrack===custom'),true);r('returnToTrackPreview()');assert.equal(r('previewSelection.origin'),origin);assert.equal(r('JSON.stringify(custom)===original'),true);
  r("$('#btnCircuitBack').click()");assert.equal(r(visible(origin==='board'?'startPanel':'importMenu')),true);
 }
});
test('preview lifecycle is isolated from a paused race and uses one canvas across all stages',()=>{
 const r=harness();r("startWithTrack(presetTrack(1),'tt');state='paused';var snapshot=JSON.stringify(player);showCircuitMenu();var circuitStage=syncPreparationPreview().stage;");
 assert.equal(r("$('#carPreview').parentElement===circuitStage"),true);r('confirmTrackPreview()');assert.equal(r("$('#carPreview').parentElement.id"),'garageStage');
 assert.equal(r('JSON.stringify(player)===snapshot'),true);r('showMainMenu()');assert.equal(r('syncPreparationPreview()'),null);
});

test('shared track links open reconnaissance before the final car choice',()=>{
 const code=harness()('encodeSharedTrack(presetTrack(7))');
 const r=harness({hash:'#t='+code});assert.equal(r(visible('circuitMenu')),true);assert.equal(r(visible('carPanel')),false);assert.equal(r('previewSelection.origin'),'import');
 r('confirmTrackPreview()');assert.equal(r(visible('carPanel')),true);assert.equal(r('preparedTrack.roadHalf'),harness()('presetTrack(7).roadHalf'));
});
