module.exports = {
run: function(link) {
  if(link.cooldown > 0) return ERR_TIRED;

  if(!link.memory.source && !link.memory.sink) {
    if(link.pos.findInRange(FIND_SOURCES, 2).length) { // harvest source
      link.memory.source = true;
    }
    if(link.pos.getRangeTo(link.room.controller) <= 4) { // upgrade sink
      link.memory.sink = true;
    }
    if(link.pos.findInRange(FIND_MY_SPAWNS, 3).length) { // spawn sink
      link.memory.sink = true;
    }
  }

  if(link.memory.source && link.energy > 200) {
    const sinks = link.room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType == STRUCTURE_LINK && s.memory.sink && s.energy+1 < s.energyCapacity});
    const dest = sinks.sort((a, b) => a.energy - b.energy).shift();
    if(dest) {
      link.transferEnergy(dest);
    }
  }
}
};

if(!StructureLink.prototype.hasOwnProperty('memory')) Object.defineProperty(StructureLink.prototype, 'memory', {
   get: function() {
       if(this.id && !this.my) return undefined;
       if(!Memory.structures) Memory.structures = {}; // XXX struct or tower?
       return Memory.structures[this.id] = Memory.structures[this.id] || {};
   },
   set: function(value) {
       if(this.id && !this.my) {
           throw new Error("Could not set other player's tower memory");
       }
       if(!Memory.structures) Memory.structures = {};
       Memory.structures[this.id] = value;
   }
});
