const BodyBuilder = require('util.bodybuilder');
const hauler = require('role2.hauler');

module.exports = {
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
    return ERR_INVALID_ARGS;
  }

  const bank = room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_POWER_BANK}}).shift();
  // XXX existing, space
  const needBust = bank;

  const res = room.find(FIND_DROPPED_RESOURCES, {filter: {resourceType: RESOURCE_POWER}}).shift();
  const needHaul = (res && res.amount > 500) || (bank && bank.hits < 100e3);

  if(needHaul) {
    const spawns = Object.values(Game.spawns).filter(s => s.isActive && !s.spawning);
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
},
};
