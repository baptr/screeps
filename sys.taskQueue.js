queue = {};

// tasks.add(tasks.HARVEST, 

const task = {
  HARVEST: "task:harvest",
  UPGRADE: "task:upgrade",
  SUPPLY: "task:supply",
  MAINTENANCE: "task:maintenance",
  COLLECT: "task:collect",
  BUILD: "task:build",
  REPAIR: "task:repair",
  CARRY: "task:carry",
};

const baseBodyUtil = {
  move: {fatigue: 2},
  work: {harvest: 2, build: 5, repair: 100, dismantle: 50, upgradeController: 1},
  attack: {attack: 30},
  ranged_attack: {rangedAttack: 10, rangedMassAttack: 10},
  heal: {heal: 12, rangedHeal: 4},
  carry: {capacity: 50},
  claim: {claim: 1},
  tough: {},
};

function bodyPower(body) {
  // TODO: Somehow reflect that boosted parts tend to cost less to use than
  // unboosted ones.
  let out = {};
  let moveFatigue = 0;
  let movePower = 0;
  _.forEach(body, p => {
    if (p.hits == 0) return;
    let util = Object.assign({hits: p.hits}, baseBodyUtil[p.type]);
    if (p.boost) {
      const boost = BOOSTS[p.type][p.boost];
      if(!boost) {
        console.log(`Invalid boost type ${p.boost} for body part ${p.type}`);
      } else {
        if(boost.damage) { // Map damage reduction to extra hits.
          util.hits = p.hits / (1 - boost.damage);
        }
        for (const act in boost) {
          if (act != "damage") {
            util[act] *= boost[act];
          }
        }
      }
    }
    if (p.type == MOVE) {
      movePower += util.fatigue;
      delete util.fatigue;
    } else {
      moveFatigue += 2;
    }
    for (const act in util) {
      out[act] = (out[act] || 0) + util[act];
    }
  });
  if (!moveFatigue) {
    out.movePower = movePower > 0 ? 1 : 0;
  } else {
    out.movePower = movePower/moveFatigue; // ~ steps per tick
  }
  return out;
}

function roomTest(room) {
  const tasks = module.exports;

  const srcs = room.find(FIND_SOURCES);
  _.forEach(srcs, s => {
    tasks.add(task.HARVEST, s, s.energyCapacity/ENERGY_REGEN_TIME);
  });
  const ctrl = room.controller;
  if(ctrl.my) {
    // How should the priority/max stay up to date?
    //   If it's been too long and the ticksToDowngrade are getting close, the priority should increase.
    //   If it's level 8, the max is 15/tick
    //   If it's level 1, maybe worth trying to get to level 2 sooner for better creeps..?
    //   Otherwise it's infinite low-mid priority (though if too low, you have to fight the cooldown each time...)
    // Thoughts:
    //  - Periodic check?
    //  - Always schedule a level's worth of upgrades (mod refilling the downgrade timer...), adjust for the next one
    //  - Make part of the task to assess if it's still accurate.. somehow?
    //  - We need to schedule some building when we level up anyway...
    tasks.add(task.UPGRADE, ctrl, ctrl.level)
  }

  // Plan and build roads...
  // Should be 3 tiers:
  //  - src <-> ctrl, src <-> spawn
  //  - near src(2)/ctrl(3)/spawn(?), remaining src/dst pairs
  //  - passing lanes
  // Later, mineral<->lab/storage fits in there somewhere
  const roadTiers = [[], [], []]; // XXX actually plan
  _.forEach(roadTiers, (roads, t) => {
    _.forEach(roads, p => {
      _.forEach(p.lookFor(LOOK_CONSTRUCTION_SITES), o => {
        if(o.structureType == STRUCTURE_ROAD) {
          tasks.add(task.BUILD, o, o.progressTotal-o.progress, {priority: t});
        }
      });
    });
  });

  // Repair roads, upgrade walls/ramparts.
  // Should this be a steady low priority "see if there's anything to do",
  //  or updated periodically with real amounts?
  tasks.add(task.MAINTENANCE, room, -1, {priority: 3});

  // When a creep dies, if it has resources:
  tasks.add(task.COLLECT, creep.pos, creep.store.getUsedCapacity(), {
    timeout: creep.body.length*TOMBSTONE_DECAY_PER_PART
  });

  // Should there be a wrapped 'build' func that creates a construction site and schedules a builder?
  // XXX ah, but you can't reference the actual ConstructionSite the same tick you run createConstructionSite,
  // so the task would have to just take a pos
  // .. and maybe upgrade to an object on a future visit?
  util.build(roomPos, STRUCTURE_CONTAINER, {priority: 2});

  // Later.. lab stuff
  // Should we:
  // - try to pre-calculate the usage rate
  // - update need on use
  // - have a flat ~ "keep topped off"
  tasks.add(task.SUPPLY, lab['O'], LAB_MINERAL_CAPACITY, {resourceType: RESOURCE_OXYGEN});
  tasks.add(task.SUPPLY, lab['O'], LAB_ENERGY_CAPACITY, {resourceType: RESOURCE_ENERGY});

  tasks.add(task.SUPPLY, lab['K'], LAB_MINERAL_CAPACITY, {resourceType: RESOURCE_KEANIUM});
  tasks.add(task.SUPPLY, lab['K'], LAB_ENERGY_CAPACITY, {resourceType: RESOURCE_ENERGY});
}

function creepTest(creep) {
  let task = creep.memory.task;
  if(!task) {
    task = tasks.pick(creep);
  }
}

// TODO: Place extensions closer to the sources once defenses are better set up.

function deliveryMath(room) {
  console.log(`Room ${room.name} delivery math:`);
  const srcs = room.find(FIND_SOURCES);
  let totalUpgradeWork = 0;
  _.forEach(srcs, src => {
    const rate = src.energyCapacity/ENERGY_REGEN_TIME;
    const harvestWork = Math.ceil(rate / HARVEST_POWER);
    // TODO: Unless it's level 8, then limit to 15/tick total...
    const upgradeWork = Math.ceil(rate / UPGRADE_CONTROLLER_POWER);
    // TODO: There might be a better way to figure out which destination is
    // furthest from the source...
    const sinks = room.find(FIND_STRUCTURES, {filter: s => {
      // TODO: What happens if we get a hauler before we've built a container?
      // Does it need to drop the energy on the ground or transfer directly to
      // the workers?
      if(s.structureType == STRUCTURE_CONTROLLER) return true;
      if(!s.store) return false;
      if(s.store.getCapacity(RESOURCE_ENERGY) <= 0) return false;
      // Make sure it's not a container near a source.
      return s.pos.findInRange(srcs, 1).length == 0;
    }});
    let maxDist = 0;
    let maxSink = null;
    _.forEach(sinks, d => {
      // TODO could consider serializing these and actually using them for transport...
      const path = room.findPath(src.pos, d.pos, {ignoreCreeps: true, maxRooms: 1, range: 1});
      if(path.length > maxDist) {
        maxDist = path.length;
        maxSink = d;
      }
    });
    if(!maxDist) {
      console.log(`Unable to find any energy sink from src@${src.pos}`);
      return;
    }
    const carryNeed = Math.ceil(rate*maxDist*2 / CARRY_CAPACITY);
    console.log(` src@${src.pos} is ${maxDist} from ${maxSink.structureType}@${maxSink.pos}`);
    console.log(` - rate=${rate} harvestWork=${harvestWork} carryNeed=${carryNeed} upgradeWork=${upgradeWork}`);
    tasks.add(task.HARVEST, src, harvestWork);
    tasks.add(task.CARRY, src, carryNeed);
    totalUpgradeWork += upgradeWork;
  });
  tasks.add(task.UPGRADE, room.controller, totalUpgradeWork);
}

// Task dependencies:
// - harvest needs energy in the source and space to get access
// - carry needs capacity, energy to pick up, and space to deliver to (possibly self?)
// - upgrade needs energy, capacity, ..?

// TODO: Think more about cross-room tasks, or whether work queues should be
// per-room.
function spawnMath(room) {
  // TODO: Should consider prioritizing tasks by if they're behind:
  // If we're harvesting a bunch, but the resources are sitting near the Source, we should carry more.
  // If we're repositioning enough but not upgrading with it fast enough, we should upgrade more.
  // If we're not consuming all of the energy in a source before it resets, we should harvest more.
  // .. but it seems hard to balance that against 'these extensions should be built'
}

class Task {
  constructor(type, target, amount, opts={}) {
    this.type = type;
    this.target = target;
    this.amount = amount;
    Object.assign(this, opts);
  }
  need() {
    // TODO precompute this at construction? (and serialize it??)
    const out = {};
    switch(this.type) {
      case task.UPGRADE:
        out.upgradeController = this.amount;
        out.capacity = 50;
        break;
      case task.CARRY:
        out.capacity = this.amount;
        out.movePower = 1; // TODO: higher if swamps in path
        break;
      case task.HARVEST:
        out.harvest = this.amount;
        break;
      case task.BUILD:
        // XXX calculate 
        out.build = this.amount;
        out.capacity = this.amount; // TODO: weight capacity higher than work since more time tends to be spent walking
        out.movePower = 1; // TODO: higher if swamps in path
        break;
      case task.REPAIR:
        out.repair = this.amount;
        out.capacity = this.amount * REPAIR_COST;
        out.movePower = 1; // TODO: higher if swamps in path
        break;
    }
    return out;
  }
}

// TODO: This could be based on actual room layout, scaled for tasks that cross
// room boundaires, or some better estimate of mean round trip time, but this
// seems like an OK weight to start with.
const TRIP_COST = 20;

function taskScore(creep, task) {
  // TODO: What percentage of the task is completed each tick?
  // If missing parts => 0
  // If full power to complete the task in 1 tick => 100%
  // If half work but full capacity => 50%
  // If full work but half capacity => 2 trips => depends on distance, something like <<5%
  // XXX Probably pass the bodyPower directly to reuse it.
  const util = bodyPower(creep.body);
  const need = task.need();
  let score = 1;
  for(const action in need) {
    let rank = (util[action] || 0) / need[action];
    score *= rank;
  }
  return score;
}

function assign(creep) {
  // Sort by some kind of scoring function that combines the creep's utility
  // (body, resources, proximity) with the priority of the task?

  // Proximity seems useful, but probably prohibitively expensive. Maybe use
  // linear distance as a tie breaker or something?

  // Do tasks sort creeps, or creeps sort tasks? Either could be suboptimal.

  // When/how should tasks be overridable?
  // - Re-check every "trip" (if applicable)?
  // - Re-check at some fixed interval?
  // - Only when complete (if applicable)?
  // - Should creation of new tasks scan active creeps to preempt?
}

module.exports = {
  add(type, target, amount, opts = {}) {},
  bodyPower,
  taskScore,
  Task,
}
Object.assign(module.exports, task);
