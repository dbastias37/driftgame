const {test}=require('node:test'),assert=require('node:assert/strict');

test('supplied pine is grounded at its trunk in both LODs, with valid UVs and normals',async()=>{
  const {default:trees}=await import('../assets/scenery/pine-tree-data.js');
  for(const tree of trees){
    const counts=[];
    for(const parts of tree.lods){
      let floor=Infinity,ceiling=-Infinity,total=0;
      for(const p of parts){
        assert(p.index.length>0);assert.equal(p.position.length,p.normal.length);assert.equal(p.position.length/3,p.uv.length/2);
        assert(p.index.every(i=>Number.isInteger(i)&&i>=0&&i<p.position.length/3));
        assert([...p.position,...p.normal,...p.uv].every(Number.isFinite));
        for(let i=1;i<p.position.length;i+=3){floor=Math.min(floor,p.position[i]);ceiling=Math.max(ceiling,p.position[i]);}
        total+=p.index.length/3;
      }
      assert(Math.abs(floor)<.025,'The trunk must meet the placement surface');
      assert(ceiling>8&&ceiling<9,'Preserve the supplied pine scale');counts.push(total);
    }
    assert(counts[1]<counts[0]/4,'Distant cells must reduce triangle cost');
  }
});

test('pine and broadleaf instances retain placement through distance LOD and overview',async()=>{
  const T=await import('../vendor/three.module.min.js');
  const {addRoadTrees}=await import('../js/road-trees.js');
  const {batchWorld,updateWorldVisibility}=await import('../js/world-optimization.js');
  const world=new T.Group(),camera=new T.PerspectiveCamera();
  const placements=[0,10,20].map(x=>new T.Matrix4().makeTranslation(x,12,0));
  addRoadTrees(world,placements);batchWorld(world);
  const matrix=new T.Matrix4();
  for(const distance of [30,149,180,500]){
    camera.position.set(0,12,distance);updateWorldVisibility(world,camera,1000);
    const shown=world.children.filter(o=>o.visible);assert.equal(shown.length,6);
    const pine=shown.filter(o=>o.userData.sourceAsset.includes('pine'));
    assert.equal(pine.length,2);
    for(const p of pine){p.getMatrixAt(0,matrix);assert.deepEqual(new T.Vector3().setFromMatrixPosition(matrix).toArray(),[20,12,0]);}
    assert.equal(new Set(shown.map(o=>o.name.replace(/-lod\d$/,''))).size,6);
  }
  updateWorldVisibility(world,camera,Infinity,true);
  assert(world.children.filter(o=>o.visible).every(o=>o.userData.overviewLOD));
});

test('large sparse vegetation cells keep close trees detailed and simplify only beyond the entire cell',async()=>{
  const T=await import('../vendor/three.module.min.js');
  const {addRoadTrees}=await import('../js/road-trees.js');
  const {batchWorld,updateWorldVisibility}=await import('../js/world-optimization.js');
  const world=new T.Group(),camera=new T.PerspectiveCamera();
  // Same variant at either side of a 512m cell: its centroid is far from the
  // first tree, but the camera beside that tree must still receive the full mesh.
  const placements=[0,10,20,450,460,470].map(x=>new T.Matrix4().makeTranslation(x,0,0));
  addRoadTrees(world,placements,{cellSize:512,lodByBounds:true});batchWorld(world);
  camera.position.set(0,3,0);updateWorldVisibility(world,camera,1000);
  assert(world.children.filter(o=>o.visible).every(o=>o.name.endsWith('lod0')));
  camera.position.set(1200,3,0);updateWorldVisibility(world,camera,2000);
  assert(world.children.filter(o=>o.visible).every(o=>o.name.endsWith('lod1')));
});
