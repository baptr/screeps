const pathUtil = require('util.pathing');

module.exports = {
  run: function(pc) {
    // TODO: memoize the renewal spot in a way that notices if we pass a better
    // candidate.

    const target = pc.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => s.structureType == STRUCTURE_POWER_BANK || s.structureType == STRUCTURE_POWER_SPAWN});
    if(target) {
      pc.moveTo(target, {swampCost: 1, plainCost: 1});
      pc.renew(target);
      return;
    }

    let options = []
    // XXX look in scouted rooms too once ready
    for(const name in Game.rooms) {
      const r = Game.rooms[name];
      options = options.concat(r.find(FIND_STRUCTURES, {filter: s => {
        if(s.structureType == STRUCTURE_POWER_BANK) return true;
        if(s.structureType == STRUCTURE_POWER_SPAWN && s.my) return true;
        return false;
      }}));
    }
    // console.log(`PC spawn options len=${options.length}: ${JSON.stringify(options)}`);
    const [remoteTarget, path] = pathUtil.macroClosest(pc.room.name, options);
    if(!path) {
      console.log(`PC[${pc.name}] unable to find renewal bank/spawn!`);
      // TODO: Start exploring nearby highways or something?
      return ERR_NOT_FOUND;
    }
    pc.moveTo(remoteTarget, {plainCost: 1, swampCost: 1});
  },
};
