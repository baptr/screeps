function demo() {
  const knowledge = {
    'E28S12': {
      lastSeen: 19700,
      sources: [{x: 16, y: 28}, {x:16, y: 24}],
      controller: {x: 18, y: 15, rcl: 3, owner: 'baptr'},
      rawMatrix: [/*blob*/],
      mineral: {x: 8, y: 21, type: RESOURCE_LEMERGIUM},
    },
    'E24S16': {
      lastSeen: 19653,
      sources: [{x: 9, y: 16}, {x: 41, y: 12}, {x: 41, y: 39}],
      mineral: {x: 6, y: 45, type: RESOURCE_KEANIUM},
      rawMatrix: [/*blob*/],
      invaderCore: {level: 1, x: 4, y: 25, store: {'X': 1, 'ZK': 45}},
      // TODO: Confirm whether lairs get offset if you kill its keeper.
      invaderLairs: [{x: 9, y: 13, estEpoch: 503+300}, {x: 37, y: 9, estEpoch: 803}, {x: 38, y: 43, estEpoch: 803}],
    }
  };
}

function dumpRoom(room) {
  const start = Game.cpu.getUsed();
  const out = {lastSeen: Game.time};

  const ctrl = room.controller
  if(ctrl) {
    // TODO: safe mode or progress info?
    let owner;
    if(ctrl.owner) owner = ctrl.owner.username;
    if(ctrl.reservation) owner = ctrl.reservation.username;
    out.controller = {
      x: ctrl.pos.x,
      y: ctrl.pos.y,
      rcl: ctrl.level,
      owner,
    };
  }

  out.sources = room.find(FIND_SOURCES).map(s => ({
    x: s.pos.x, y: s.pos.y,
    max: s.energyCapacity}));

  const deps = room.find(FIND_DEPOSITS).map(d => ({
    x: d.pos.x, y: d.pos.y,
    type: d.depositType,
    ticksLeft: d.ticksToDecay}));
  if(deps.length) { // TODO: decide when to do empty absent. Just based on prevalence?
    out.deposits = deps;
  }

  const minerals = room.find(FIND_MINERALS).map(m => ({
    x: m.pos.x, y: m.pos.y,
    type: m.mineralType,
    density: m.density,
    ticksLeft: m.ticksToRegenerate}));
  if(minerals.length) {
    if(minerals.length > 1) {
      console.log(`Room ${room.name} has multiple minerals, dumpRoom doesn't support this: ${JSON.stringify(minerals)}`);
    }
    out.mineral = minerals[0];
  }

  const structs = room.find(FIND_STRUCTURES);

  for(const s of structs) {
    if(s instanceof StructureKeeperLair) {
      if(!out.invaderLairs) out.invaderLairs = [];
      // XXX figure out what ticksToSpawn looks like when a keeper is still active.
      // I probably need to look for nearby keeper creeps and add 300 to their TTL.
      out.invaderLairs.push({x: s.pos.x, y: s.pos.y, nextSpawn: s.ticksToSpawn}); 
    } else if(s instanceof StructureInvaderCore) {
      out.invaderCore = {
        x: s.pos.x, y: s.pos.y,
        level: s.level,
      }
      const store = {};
      const conts = structs.filter(s => s.strutureType == STRUCTURE_CONTAINER);
      for(const c of conts) {
        for(const [t, v] of Object.entries(c.store)) {
          store[t] = (store[t] || 0) + v;
        }
      }
      out.invaderCore.store = store;
    } else if(s instanceof StructureTower) {
      if(!out.towers) out.towers = [];
      out.towers.push({x: s.pos.x, y: s.pos.y});
    }
  }

  // Matrix...
  const matrix = new PathFinder.CostMatrix;
  const terrain = room.getTerrain().getRawBuffer();
  for(let y = 0; y < 50; y++) {
    for(let x = 0; x < 50; x++) {
      const tile = terrain[y*50 + x];
      const cost =
        tile == TERRAIN_MASK_WALL  ? WALL_WEIGHT :
        tile == TERRAIN_MASK_SWAMP ? SWAMP_WEIGHT : PLAINS_WEIGHT;
      matrix.set(x, y, cost);
    }
  }

  for(const s of structs) {
    if(OBSTACLE_OBJECT_TYPES.includes(s.structureType)) {
      matrix.set(s.pos.x, s.pos.y, OBSTACLE_WEIGHT);
    } else if(s instanceof StructureRampart && !s.my) {
      matrix.set(s.pos.x, s.pos.y, RAMPART_WEIGHT);
    } else if(s instanceof StructureRoad) {
      if(matrix.get(s.pos.x, s.pos.y) != RAMPART_WEIGHT) {
        matrix.set(s.pos.x, s.pos.y, ROAD_WEIGHT);
      }
    }
  }
  out.rawMatrix = matrix.serialize();
  //console.log(`dumpRoom(${room.name}) took ${Game.cpu.getUsed() - start}ms. rawMatrix is ${JSON.stringify(out.rawMatrix).length} chars. vs ${matrix._bits.length} _bits`);

  return out;
}

// XXX Need to map all obstacles to 255 for use, but this lets us embed some
// possibly useful data fairly cheaply.
const RAMPART_WEIGHT = 253;
const OBSTACLE_WEIGHT = 254;
const WALL_WEIGHT = 255;
const SWAMP_WEIGHT = 10;
const PLAINS_WEIGHT = 2;
const ROAD_WEIGHT = 1;

module.exports = {
  dumpRoom,
  test: function(iterations=1, dim=10, room='E28S12') {
    // TODO: Consider compression. lz-string, custom indexed RLE, just better bit packing?
    // matrix.serialize turns 2500 uint8s (locally limited to 6 values) into 6500 chars as a json Uint32Array
    // The loose data for a populated room is less than 300 chars more.
    // RawMemory segments are at most 100kb, so room for ~14 rooms worth of data per segment.
    const start = Game.cpu.getUsed();
    const raw = dumpRoom(Game.rooms[room]);
    const big = {};
    for(let x = 0; x < dim; x++) {
      for(let y = 0; y < dim; y++) {
        big[`E${x}N${y}`] = raw;
      }
    }
    const gen = Game.cpu.getUsed();
    const str = JSON.stringify(big);
    const stringed = Game.cpu.getUsed();
    for(let i = 0; i < iterations; i++) {
      JSON.parse(str);
    }
    const end = Game.cpu.getUsed();
    console.log(`dumpRoom(${room}) test done. dump took ${gen-start}ms. serialized ${dim}x${dim} macro grid into ${str.length} chars in ${stringed-gen}ms; deserialized in ${(end-stringed)/iterations}ms each`);
    return raw;
  }
};
