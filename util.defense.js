const ROOM_DIM = 50;

// obsDist labels the room with the manhattan distances from each position to
// the nearest wall.
function obsDist(room) {
  const cost = new Array(ROOM_DIM);
  for(let y = 0; y < ROOM_DIM; y++) {
    cost[y] = new Array(ROOM_DIM).fill(-1);
  }
  const terrain = room.getTerrain().getRawBuffer();
  for(let y = 0; y < ROOM_DIM; y++) {
    for(let x = 0; x < ROOM_DIM; x++) {
      if(terrain[y*ROOM_DIM + x] & TERRAIN_MASK_WALL) {
        cost[y][x] = 0;
      }
    }
  }
  for(let step = 1; step < ROOM_DIM/2; step++) {
    let miss = 0;
    for(let y = 0; y < ROOM_DIM; y++) {
      for(let x = 0; x < ROOM_DIM; x++) {
        if(cost[y][x] >= 0) continue;
        let min = ROOM_DIM;
        for(let j = y-1; j <= y+1; j++) {
          if(j < 0 || j >= ROOM_DIM) continue;
          for(let i = x-1; i <= x+1; i++) {
            if(i < 0 || i >= ROOM_DIM) continue;
            if(x != i && y != j) continue;
            const val = cost[j][i];
            if(val >= 0 && val < min) min = val;
          }
        }
        if(min+1 == step) {
          cost[y][x] = min+1;
        } else {
          miss++;
        }
      }
    }
    console.log("step " + step + " done, missed " + miss);
    if(miss == 0) break;
  }

  const viz = room.visual;
  for(let y = 0; y < ROOM_DIM; y++) {
    for(let x = 0; x < ROOM_DIM; x++) {
      const colorVal = cost[y][x] * 20;
      const color = `rgb(${100+colorVal}, ${colorVal}, ${colorVal})`
      viz.text(cost[y][x], x, y, {font: 0.5, color});
    }
  }
  return viz.export();
}

// exitMatrix returns a PathFinder.CostMatrix which treats walls as cheaper
// than open space, useful for finding good chokepoints to build defenses.
function exitMatrix(roomName, openWeight=10) {
  const terrain = new Room.Terrain(roomName).getRawBuffer();

  let allExits = [];
  const room = Game.rooms[roomName];

  const pos = (x, y) => {
    if(room) return room.getPositionAt(x, y);
    return new RoomPosition(x, y, roomName);
  };

  if(room) {
    allExits = room.find(FIND_EXIT);
  } else {
    for(let i = 0; i < ROOM_DIM; i++) {
      if(!terrain[i] & TERRAIN_MASK_WALL) {
        allExits.push(pos(i, 0));
      }
      if(!terrain[(ROOM_DIM-1)*ROOM_DIM + i] & TERRAIN_MASK_WALL) {
        allExits.push(pos(i, ROOM_DIM-1));
      }
      if(!terrain[i*ROOM_DIM] & TERRAIN_MASK_WALL) {
        allExits.push(pos(0, i));
      }
      if(!terrain[i*ROOM_DIM + ROOM_DIM-1] & TERRAIN_MASK_WALL) {
        allExits.push(pos(ROOM_DIM-1, i));
      }
    }
  }

  const costs = new PathFinder.CostMatrix;
  for(let x = 0; x < ROOM_DIM; x++) {
    for(let y = 0; y < ROOM_DIM; y++) {
      const p = pos(x, y);
      if(terrain[y*ROOM_DIM + x] & TERRAIN_MASK_WALL) {
        // Making this not free gently weights against making bigger loops than
        // necessary, but probably requires some tuning.
        costs.set(x, y, 1);
      } else if(allExits.find(e => p.getRangeTo(e) <= 1)) {
        costs.set(x, y, 255);
      } else {
        costs.set(x, y, openWeight);
      }
    }
  }

  if(room) room.find(FIND_STRUCTURES).concat(room.find(FIND_CONSTRUCTION_SITES)).forEach(s => {
    switch(s.structureType) {
    case STRUCTURE_WALL:
    case STRUCTURE_RAMPART:
      // TODO: Can this be a little more expensive than a natural wall, to
      // reflect its maintenance cost?
      costs.set(s.pos.x, s.pos.y, 1);
      break;
    }
  });
  return costs;
}

// Queue is a trivially implemented (grossly unoptimized) priority queue.
class Queue {
  constructor(compare = (a, b) => a-b) {
    this.compare = compare;
    this.data = [];
  }

  push(...data) {
    for(const n of data) {
      const idx = this.data.findIndex(f => n.x == f.x && n.y == f.y);
      if(idx >= 0) {
        const f = this.data[idx];
        console.log(`Trying to re-insert a neighbor. Was ${JSON.stringify(f)}, now ${JSON.stringify(n)}`);
        this.data[idx] = n;
      } else {
        this.data.push(n);
      }
    }
    this.data.sort(this.compare);
  }

  pop() {
    return this.data.pop();
  }
}

// findNeighbors returns an array of all walkable neighbor cells.
function findNeighbors(prev, matrix) {
  const baseCost = prev.cost;
  const x = prev.x;
  const y = prev.y;

  const neighbors = [];
  if(x > 0) {
    const stepCost = matrix.get(x-1, y);
    if(stepCost < 255) {
      neighbors.push({prev, cost: baseCost+stepCost, x: x-1, y});
    }
  }
  if(x < ROOM_DIM-1) {
    const stepCost = matrix.get(x+1, y);
    if(stepCost < 255) {
      neighbors.push({prev, cost: baseCost+stepCost, x: x+1, y});
    }
  }
  if(y > 0) {
    const stepCost = matrix.get(x, y-1);
    if(stepCost < 255) {
      neighbors.push({prev, cost: baseCost+stepCost, x, y: y-1});
    }
  }
  if(y < ROOM_DIM-1) {
    const stepCost = matrix.get(x, y+1);
    if(stepCost < 255) {
      neighbors.push({prev, cost: baseCost+stepCost, x, y: y+1});
    }
  }
  return neighbors;
}

// blockDist returns the direct-route manhattan distance between two positions.
function blockDist(node, goal) {
  return Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y);
}

const MAX_COST = 1<<30;

// solve does a manhattan-distance A* between the provided positions.
function solve(start, goal, matrix) {
  const open = new Queue((a, b) => b.cost - a.cost);
  open.push({cost: 0, est: blockDist(start, goal), x: start.x, y: start.y});

  const bestCost = new Array(ROOM_DIM*ROOM_DIM).fill(MAX_COST)

  let node;
  while (node = open.pop()) {
    if(node.x == goal.x && node.y == goal.y) {
      return node;
    }
    const neighbors = findNeighbors(node, matrix);
    for(const n of neighbors) {
      const costPos = n.y*ROOM_DIM + n.x;
      if(n.cost >= bestCost[costPos]) continue;
      bestCost[costPos] = n.cost;
      n.est = n.cost + blockDist(n, goal);
      open.push(n);
    }
  }
  return false;
}

function planRoom(roomName, openWeight=10) {
  const matrix = exitMatrix(roomName, openWeight);

  const terrain = new Room.Terrain(roomName).getRawBuffer();
  const isOpen = (x, y) => !terrain[y*ROOM_DIM + x] & TERRAIN_MASK_WALL;
  let [topMin, topMax] = [ROOM_DIM, 0];
  let [botMin, botMax] = [ROOM_DIM, 0];
  let [leftMin, leftMax] = [ROOM_DIM, 0];
  let [rightMin, rightMax] = [ROOM_DIM, 0];
  for(let i = 0; i < ROOM_DIM; i++) {
    if(isOpen(i, 0)) { // top
      if(i <= topMin) topMin = i-1;
      if(i >= topMax) topMax = i+1;
    }
    if(isOpen(i, ROOM_DIM-1)) { // bottom
      if(i <= botMin) botMin = i-1;
      if(i >= botMax) botMax = i+1;
    }
    if(isOpen(0, i)) { // left
      if(i <= leftMin) leftMin = i-1;
      if(i >= leftMax) leftMax = i+1;
    }
    if(isOpen(ROOM_DIM-1, i)) { // right
      if(i <= rightMin) rightMin = i-1;
      if(i >= rightMax) rightMax = i+1;
    }
  }

  // TODO: Deduplicate positions that apply to multiple sides
  let totalCost = 0;
  if(topMin < topMax) {
    const ret = solve({x: topMin, y: 0}, {x: topMax, y: 0}, matrix);
    if(ret) {
      totalCost += show(roomName, ret, matrix);
    } else console.log(`No solution for TOP of ${roomName} (${topMin} - ${topMax}): ${ret}`);
  }
  if(botMin < botMax) {
    const ret = solve({x: botMin, y: ROOM_DIM-1}, {x: botMax, y: ROOM_DIM-1}, matrix);
    if(ret) {
      totalCost += show(roomName, ret, matrix);
    } else console.log(`No solutiion for BOTTOM of ${roomName} (${botMin} - ${botMax}): ${ret}`);
  }
  if(leftMin < leftMax) {
    const ret = solve({x: 0, y: leftMin}, {x: 0, y: leftMax}, matrix);
    if(ret) {
      totalCost += show(roomName, ret, matrix);
    } else console.log(`No solution for LEFT of ${roomName} (${leftMin} - ${leftMax}): ${ret}`);
  }
  if(rightMin < rightMax) {
    const ret = solve({x: ROOM_DIM-1, y: rightMin}, {x: ROOM_DIM-1, y: rightMax}, matrix);
    if(ret) {
      totalCost += show(roomName, ret, matrix);
    } else console.log(`No solution for RIGHT of ${roomName} (${rightMin} - ${rightMax}): ${ret}`);
  }
  return totalCost;
}

function show(roomName, path, matrix) {
  let cost = 0;
  const viz = new RoomVisual(roomName);
  let prev = path;
  let dump = 0;
  while(path) {
    if(matrix.get(path.x, path.y) != 1) {
      cost++;
      viz.line(prev.x, prev.y, path.x, path.y);
    } else if (cost > dump) {
      viz.text(cost-dump, prev.x, prev.y);
      dump = cost;
    }
    prev = path;
    path = path.prev;
  }
  Memory.viz[roomName] = viz.export();
  return cost;
}

module.exports.test = function(roomName, openWeight=10) {
  const matrix = exitMatrix(roomName, openWeight);
  let ret = solve(Game.flags.start.pos, Game.flags.end.pos, matrix);
  if(ret) {
    show(roomName, ret, matrix);
  }  else {
    console.log("unable to solve defenses");
  }
}
module.exports.viz = obsDist;
module.exports.rev = 2;
module.exports.planRoom = planRoom;
