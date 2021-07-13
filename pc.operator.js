const pcRenew = require('role.pcRenew');
const haulerRole = require('role2.hauler');

module.exports = {
CLASS: POWER_CLASS.OPERATOR,
run: function(pc) {
  for(const pwr in pc.powers) {
    if(pc.powers[pwr].cooldown > 0) continue;
    switch(parseInt(pwr)) {
    case PWR_OPERATE_EXTENSION:
      const store = pc.room.storage;
      // TODO: Base on power level.
      if(store && store.store.energy > 2000 && pc.room.energyAvailable < pc.room.energyCapacityAvailable*0.75) {
        // Might be too far away, but we can keep spamming it until it works.
        const ret = pc.usePower(pwr, store);
      }
      break;
    case PWR_GENERATE_OPS:
      const ret = pc.usePower(pwr);
      break;
    }
  }
  if(pc.ticksToLive < 2000) {
    if(pcRenew.run(pc) != ERR_NOT_FOUND) return;
  }
  // TODO: Do something more interesting/dynamic.
  haulerRole.run(pc);
}
};
