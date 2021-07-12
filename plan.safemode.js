const creepUtil = require('util.creep');

module.exports = {
check: function(room) {
  const ctrl = room.controller;
  if(!ctrl || !ctrl.my || !ctrl.safeModeAvailable || ctrl.safeModeCooldown) return false;

  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if(!hostiles.length) return false;

  // TODO: Is it safe to splay this? If I'm counting incoming damage from the
  // event log, we don't want to miss it.. but it seems expensive.

  // TODO: diminish danger by travel time necessary to demonstrate it?
  // TODO: and ticks of life left.
  let danger = 0;
  for(const c of hostiles) {
    danger += creepUtil.bodyPower(c, CLAIM, CONTROLLER_CLAIM_DOWNGRADE);
    danger += creepUtil.bodyPower(c, ATTACK, ATTACK_POWER);
    danger += creepUtil.bodyPower(c, RANGED_ATTACK, RANGED_ATTACK_POWER);
  }

  // Seems like little enough that we should be able to survive it..?
  // Just 5 attack, or 15 ranged.
  if(danger < 300) return false;

  let dmg = 0;
  // TODO: Check attackController events too.
  for(const l of room.getEventLog()) {
    if(l.event != EVENT_ATTACK) return;
    const src = Game.getObjectById(l.objectId);
    if(!src || src.my) return;
    const dest = Game.getObjectById(l.data.targetId);
    if(dest && dest.my) {
      dmg += l.data.damage;
    }
  }
  // TODO: Maybe use a lower threshold for actual damage?
  // TODO: Or wait for closer to wall/rampart breach?
  if(dmg < 300) return false;

  // TODO: Something else?
  //  maybe when towers are empty, or we've run out of ways to get energy for defenders?
  
  if(ctrl.safeModeAvailable < 2) {
    console.log(`Would recommend safemode in ${room.name} at tick ${Game.time}, but refusing to spend the last few`);
    return false;
  }
  return true;
},
}
