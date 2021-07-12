const scoutUtil = require('util.scout');
const scoutRole = require('role2.scout');

function keepUnique(val, idx, arr) {
  return arr.indexOf(val) == idx;
}

function parseRoom(name) {
  const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(name);
  return {
    name: name,
    sector: parsed[1]+parsed[3],
    x: parseInt(parsed[2], 10),
    y: parseInt(parsed[4], 10),
  };
}

function update() {
  for(const name in Game.rooms) {
    if(scoutUtil.needsUpdate(name)) {
      scoutUtil.update(Game.rooms[name]);
    }
  }
}

function run() {
  // TODO: do macro-level searching to decide where else to go.
  const baseRooms = Object.values(Game.spawns).map(s => s.room.name).filter(keepUnique);
  const worldSize = Game.map.getWorldSize();
  const maxDim = worldSize/2 - 1;
  const targetRooms = new Set();

  for(const src of baseRooms) {
    const p = parseRoom(src);
    // Find the closest highway intersection as the base point.
    const baseX = Math.round(p.x/10)*10;
    const baseY = Math.round(p.y/10)*10;

    console.log(`plan.scout[${src}] - start (${baseX}, ${baseY})`);

    // Scout towards the next nearest intersection in each direction.
    for(let [x, y] of [[baseX+10, baseY], [baseX-10, baseY], [baseX, baseY+10], [baseX, baseY-10]]) {
      if(x > maxDim) continue;
      if(y > maxDim) continue;
      let ew = p.sector[0];
      let ns = p.sector[1];
      if(x < 0) {
        ew = (ew == 'W' ? 'E' : 'W');
        x = -x + 1;
      }
      if(y < 0) {
        ns = (ns == 'N' ? 'S' : 'N');
        y = -y + 1;
      }
      const dest = `${ew}${x}${ns}${y}`;
      if(Game.map.getRoomStatus(dest).status == 'closed') continue;
      targetRooms.add(dest);
    }
  }
  // TODO: Strike out destinations that we'd hit via other scouts.
  // TODO: Notice if we'd miss intermediate highway rooms (generally the
  // closest ones :-\)
  for(const r of targetRooms) {
    if(!scoutRole.exists(r)) {
      // TODO: This doesn't optimize to always use the spawner closest to the
      // target, it just choses the closer ones of those *currently available*.
      // XXX return hack to not fight with ourselves to use the spawners.
      if(scoutRole.spawn(r) == OK) return;
    }
  }
}

module.exports = {
  update,
  run,
};
