const LOCALS = require('local');

const ROLES = ['harvester', 'defender', 'claimer', 'relocater', 'miner', 'bob', 'pcRenew'];
const ROLE2S = ['bootstrapper', 'remoteHarvester', 'dropHarvester', 'builder',
                'miner', 'combatant', 'dismantler', 'carrier', 'scout',
                'hauler', 'storeUpgrader', 'recycle', 'reserver', 'healer',
                'waiter', 'keeperKiller', 'delivery', 'roadWorker', 'bankBuster',
                'powerLoader', 'bother'];
var role = {};
_.forEach(ROLES, r => {
    role[r] = require('role.'+r);
})
_.forEach(ROLE2S, r => {
    let m = require('role2.'+r);
    if(m.ROLE) {
        r = m.ROLE;
    }
    if(role[r]) {
        console.log("Duplicate role: "+r);
        role[r+"_2"] = m;
    } else {
        role[r] = m;
    }
})

const PLANNERS = ['claim', 'lab', 'attack', 'room', 'remoteHarvest', 'power', 'scout', 'safemode'];
var plan = {};
_.forEach(PLANNERS, p => {plan[p] = require('plan.'+p)});

const STRUCTS = ['tower', 'link'];
var struct = {};
_.forEach(STRUCTS, s => {struct[s] = require('struct.'+s)});

const UTILS = ['creep', 'pathing', 'stats', 'splay'];
var util = {};
_.forEach(UTILS, u => {util[u] = require('util.'+u)});

const opsPower = require('pc.operator');

const profiler = require('screeps-profiler');

profiler.enable();
_.forEach(role, (m, r) => profiler.registerObject(m, 'role.'+r));
_.forEach(plan, (m, p) => profiler.registerObject(m, 'plan.'+p));
_.forEach(struct, (m, s) => profiler.registerObject(m, 'struct.'+s));
_.forEach(util, (m, u) => profiler.registerObject(m, 'util.'+u));

console.log(`Reloading at tick ${Game.time}`);

function buildingSay(struct, text) {
    struct.room.visual.text(
        text,
        struct.pos.x + 1, 
        struct.pos.y, 
        {align: 'left', opacity: 0.8});
}

const main = {
runPlanners: function() {
    _.forEach(Game.rooms, r => {
        plan.room.run(r);
        if(plan.safemode.check(r)) {
          const ret = r.controller.activateSafeMode();
          console.log(`Activating safemode in ${r.name} at ${Game.time} = ${ret}`);
        }
    })

    plan.scout.update();

    plan.lab.test();
    plan.claim.test();
    if(LOCALS.ATTACK) {
      plan.attack.test();
   }
    for(const r of LOCALS.remoteHarvestRooms) {
      plan.remoteHarvest.plan(r);
    }

    for(const r of LOCALS.powerRooms) {
      plan.power.run(r);
    }
    if(Game.flags.Power && !LOCALS.powerRooms.includes(Game.flags.Power.pos.roomName)) {
      plan.power.run(Game.flags.Power.pos.roomName);
    }
},
cleanup: function() {
    const lost = [];
    for(const name in Memory.creeps) {
        if(!Game.creeps[name]) {
            const mem = Memory.creeps[name];
            let plaque = name;
            if(mem.delivered) {
                plaque += ' (delivered '+mem.delivered+')';
            }
            if(mem.cost) {
                plaque += ' (cost '+mem.cost+')';
            }
            if(mem.life) {
                plaque += ' (life '+JSON.stringify(mem.life)+')';
            }
            lost.push(plaque)
            delete Memory.creeps[name];
        }
    }
    if(lost.length) { console.log('Lost '+lost); }
},
runCreeps: function() {
    _.forEach(Game.creeps, creep => {
        // TODO(baptr): Some day I'm going to want to do something while some
        // role is still spawning, but until then...
        if(creep.spawning) return;
        const roleName = creep.memory.role;
        var r = role[roleName];
        if(r) {
            r.run(creep);
        } else {
            console.log(`${creep.name} has unknown role (${roleName})`);
        }
    });
    _.forEach(Game.powerCreeps, pc => {
      if(!pc.ticksToLive) return;
      if(pc.className != opsPower.CLASS) return;
      opsPower.run(pc);
    });
},
runStructs: function() {
    _.forEach(Game.structures, s => {
        let m = struct[s.structureType];
        if(m) m.run(s);
    });
}
}
profiler.registerObject(main, 'main');

module.exports.loop = () => profiler.wrap(() => {
    main.runPlanners();
    
    if(!Memory.viz) Memory.viz = {};
    for(const roomName in Memory.viz) {
      if(roomName == "map") {
        Game.map.visual.import(Memory.viz[roomName]);
      } else {
        new RoomVisual(roomName).import(Memory.viz[roomName]);
      }
    }
    if(Game.time % 20 == 0) {
        // Periodic cleanup
        main.cleanup();
    }
    
    main.runCreeps();
    main.runStructs();

    if(Game.flags.scout && !role.scout.exists(Game.flags.scout.pos.roomName)) {
      role.scout.spawn(Game.flags.scout.pos.roomName);
    }
    
    // Segmented stats are read every 15s.
    Memory.cpu_stats += Game.cpu.getUsed();
    if(Game.time % 50 == 0) {
        const stats = util.stats.run(Memory.cpu_stats);
        // Memory.stats = stats;
        RawMemory.segments[99] = JSON.stringify(stats);
    }
    if(Game.cpu.generatePixel && Game.cpu.bucket >= 10000) Game.cpu.generatePixel();
})
