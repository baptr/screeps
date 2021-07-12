const BodyBuilder = require('util.bodybuilder');
const pathUtil = require('util.pathing');

const hauler = require('role2.hauler');
const keeperKiller = require('role2.keeperKiller');
const bankBuster = require('role2.bankBuster');
const scout = require('role2.scout');

function keepUnique(val, idx, arr) {
  return arr.indexOf(val) == idx;
}

function spacesNear(roomName, pos) {
  const terrain = Game.map.getRoomTerrain(roomName);

  let melee = 0;
  for(let y = pos.y-1; y <= pos.y+1; y++) {
    for(let x = pos.x-1; x <= pos.x+1; x++) {
      if(terrain.get(x, y) != TERRAIN_MASK_WALL) melee++;
    }
  }

  let ranged = -melee-2; // Leave space for new melee to come in
  for(let y = pos.y-3; y <= pos.y+3; y++) {
    for(let x = pos.x-3; x <= pos.x+3; x++) {
      if(terrain.get(x, y) != TERRAIN_MASK_WALL) ranged++;
    }
  }
  return {melee, ranged};
}

function spawnDistance(spawn, bank) {
  // Dynamic body sizes make this hard, but the current busters tend to be
  // slightly better than 1:1 MOVE:other, so default 1:5 tick steps should be
  // safe.
  const path = pathUtil.longPath(spawn.pos, bank.pos, {range: 1, cache: true});
  if(path == ERR_NO_PATH || path.incomplete) return Infinity;
  return path.cost;
}

function spawnBusters(bank) {
  const allSpawns = Object.values(Game.spawns);
  // TODO: Decide distance threshold.
  // It's a waste of energy to have a big buster spend most of its life
  // traveling, but not having one at all is worse.
  const availSpawns = allSpawns.filter(s => s.isActive() && !s.spawning && s.room.energyAvailable >= 600 && spawnDistance(s, bank) <= 600);
  if(!availSpawns.length) return ERR_NOT_ENOUGH_ENERGY; // TODO: might not actually need more busters

  const roomName = bank.pos.roomName;
  const spaces = spacesNear(roomName, bank.pos);

  // How long before we need to fit another melee attacker in?
  // Should we spawn another ranged first?

  const ttl = bank.ticksToDecay;

  const meleeAssigned = keeperKiller.assigned(roomName);
  const rangedAssigned = bankBuster.assigned(roomName);

  const meleeDmg = bank.pos.findInRange(meleeAssigned, 1).reduce(
    (acc, c) => acc+c.getActiveBodyparts(ATTACK)*ATTACK_POWER*Math.min(c.ticksToLive, ttl), 0);
  const rangedDmg = bank.pos.findInRange(rangedAssigned, 3).reduce(
    (acc, c) => acc+c.getActiveBodyparts(RANGED_ATTACK)*RANGED_ATTACK_POWER*Math.min(c.ticksToLive, ttl), 0);
  const remainingHealth = bank.hits - (meleeDmg + rangedDmg);
  console.log(`hits=${bank.hits} - ${meleeDmg} - ${rangedDmg} = ${remainingHealth} left`);

  // How long does it take to do bank.hits damage with the nearby creeps?
  // We have a total rate right now, and some time at which that will change
  //  (either because another arrives, or one ages out)
  let ticks = 0;
  // How long until the first creep dies (or the next arrives)?
  // How many hits are left at that point?
  // etc


  if(remainingHealth < 0) return OK; // TODO: Figure out safety buffer

  // TODO: Could save a lot of energy to use more time cycling in melee busters
  // rather than rushing ranged.
  // Need to solve for how much damage we can reliably do just with melee over
  // the full decay time, and only supplement with ranged to cover gaps in
  // that.
  for(const s of availSpawns) {
    const dist = spawnDistance(s, bank);
    if(dist == Infinity) continue;
    const live = meleeAssigned.filter(c => c.ticksToLive >= dist);
    if(live.length < spaces.melee) {
      console.log(`${live.length} of ${meleeAssigned.length} vs ${spaces.melee} @ ${dist}, spawning melee`);
      if(keeperKiller.spawn(s, roomName) == OK) {
        console.log(`Spawning keeperKiller for ${roomName} from ${s.pos.roomName}`);
        meleeAssigned.push({ticksToLive: 1500});
      }
      // Save up for melee even if it didn't work, if we decided we wanted one.
      availSpawns.shift();
    }
  }

  for(const s of availSpawns) {
    const dist = spawnDistance(s, bank);
    const live = rangedAssigned.filter(c => c.ticksToLive >= dist);
    if(live.length < spaces.ranged) {
      console.log(`${live.length} of ${rangedAssigned.length} vs ${spaces.ranged} @ ${dist}, spawning ranged`);
      if(bankBuster.spawn(s, roomName) == OK) {
        console.log(`Spawning bankBuster for ${roomName} from ${s.pos.roomName}`);
        rangedAssigned.push({ticksToLive: 1500});
        availSpawns.shift();
      }
    }
  }
  return ERR_NOT_ENOUGH_RESOURCES
}

module.exports = {
inProgress: function() {
  return false;
},
scoutTest: function() {
  const baseRooms = Object.values(Game.spawns).map(s => s.room.name).filter(keepUnique);
  for(const roomName in Memory.scout) {
    const info = Memory.scout[roomName];
    if(!info.powerBank) continue;

    const pb = info.powerBank;
    const ttl = pb.expires - Game.time;

    // TODO: make sure we don't abort gathering of a bank we did bust recently
    if(ttl < 0) continue; // Stale scout

    const spaces = spacesNear(roomName, pb);

    // TODO: This doesn't seem like exactly the right approach, but have to start somewhere.
    const hitsPerTick = Math.ceil(pb.hits / ttl);
    const allAttack = Math.ceil(pb.hits / ttl / ATTACK_POWER);
    const allRanged = Math.ceil(pb.hits / ttl / RANGED_ATTACK_POWER);

    const attackCost = (BODYPART_COST[ATTACK] + BODYPART_COST[MOVE]) * allAttack;
    const rangedCost = (BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE]) * allRanged;

    console.log(`Have ${ttl} ticks to bust ${roomName}: ${hitsPerTick} min hits/t w/ ${spaces.melee} melee, ${spaces.ranged} ranged spaces`);
    console.log(` - could be ${allAttack} ATTACK (${attackCost} energy) or ${allRanged} RANGED_ATTACK (${rangedCost} energy)`);

    const room = Game.rooms[roomName];
    const bodyPower = c => c.getActiveBodyparts(ATTACK)*ATTACK_POWER + c.getActiveBodyparts(RANGED_ATTACK)*RANGED_ATTACK_POWER;
    if(room) { // See if we already have anything attacking, figure out if it's enough.
      const bank = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_POWER_BANK}).shift();
      let creeps;
      if(bank) {
        creeps = bank.pos.findInRange(FIND_MY_CREEPS, 3);
      } else {
        creeps = room.find(FIND_MY_CREEPS);
      }
      const dmg = creeps.reduce((acc, c) => acc + bodyPower(c), 0);
      const total = creeps.reduce((acc, c) => acc + bodyPower(c) * Math.min(c.ticksToLive, ttl), 0);
      console.log(` - dealing ~${dmg}/t now, ${total} before EoL - ${pb.hits - total} uncovered`);
    }

    for(const baseName of baseRooms) {
      const path = pathUtil.macroPath(baseName, roomName);
      if(path == ERR_NO_PATH) continue;
      // TODO: Weigh doing low-level pathing (and swamp/road calculations) for
      // an accurate tick/step count.
      const estDist = path.length * 50;
      const base = Game.rooms[baseName];
      console.log(`  - spawn[${baseName}] is ${path.length} rooms (~${estDist} steps) away w/ ${base.energyAvailable}/${base.energyCapacityAvailable} energy`);
    }
  }
},
run: function(roomName) {
  if(Game.time % 20 != 19) return;

  // TODO: calculate and cache travel times from nearby spawns w/ different speed ratios
  // TODO: figure out how fast we need to break it
  // TODO: look at how many attackers can fit around the bank, spawn those
  // TODO: look at how many ranged can fit, spawn those
  // TODO: figure out how soon it'll break at current speeds so haulers can be in place.
  // TODO: make roads at least part of the way if there are swamps
  const room = Game.rooms[roomName];
  if(!room) {
    console.log(`plan.power[${roomName}] lost vis!`);
    if(!scout.exists(roomName)) scout.spawn(roomName);
    return ERR_INVALID_ARGS;
  }

  const bank = room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_POWER_BANK}}).shift();
  // XXX existing, space
  const needBust = bank;

  if(needBust) {
    if(spawnBusters(bank) != OK) return;
  }

  // TODO: If haulers are still on the way, and we have time, wait to bust
  // until they're closer.

  const res = room.find(FIND_DROPPED_RESOURCES, {filter: {resourceType: RESOURCE_POWER}}).shift();
  let amount;
  if(res) {
    amount = res.amount
  } else if(bank) {
    amount = bank.power;
  }
  const assigned = hauler.assigned(roomName);
  const assignedCapacity = assigned.reduce((acc, c) => acc + c.store.getCapacity(), 0);
  const needHaul = (res && res.amount > 1000) || (bank && bank.hits < 800e3);

  if(needHaul) {
    const spawns = Object.values(Game.spawns).filter(s => s.isActive() && !s.spawning);
    for(const spawn of spawns) {
      // XXX travel time is important
      const body = new BodyBuilder([], spawn.room.energyAvailable);
      body.extend([MOVE, CARRY, MOVE, MOVE, MOVE, MOVE, CARRY]); // basis for 2:1 swamp movement while laden
      if(!body.count(CARRY)) continue;
      const ret = spawn.spawnCreep(body.body, `longHaul-${spawn.room.name}-${Game.time}`, {memory: {
        role: hauler.ROLE,
        remoteRoom: roomName,
        dest: Game.spawns.Home.room.storage.id,
        cost: body.cost,
      }});
      console.log(`plan.power[${roomName}] spawning longHauler from ${spawn.room.name}: ${ret}`);
    }
  }

  // TODO: Cleanup:
  // - recycle (most) remaining attackers at the nearest spawn.
  // - recycle haulers if they finish a trip and won't make another, or if there's nothing left.
  // - delete the flag
  // - maybe schedule some more scouts?
},
};
