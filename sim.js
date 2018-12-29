// Copyright 2018 Thomas Stanis <tstanis@gmail.com>

SIM_LENGTH = 10000;

TIME_STEP = 1;
NUM_NURSES = 2;
NUM_PATIENTS = 4;
PATIENTS_PER_NURSE = 2;
NURSE_SPEED = 40;

BATHROOM_MIN = 100;
BATHROOM_MAX = 240;
BATHROOM_TIME = 1;

DIET_MIN = 8 * 60;
DIET_MAX = 12 * 60;
GET_MEAL_TIME = 1;
DIET_TIME = 15;

MED_MIN = 8 * 60;
MED_MAX = 12 * 60;
GET_MED_TIME = 5;
MED_TIME = 1;

class Location {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

KITCHEN = new Location(220, 250);
MED_DEPO = new Location(270, 250);
NURSE_STATION = new Location(250, 250);

BOARD = {'KITCHEN' : KITCHEN, 'MED_DEPO' : MED_DEPO, 'NURSE_STATION' : NURSE_STATION, 'WIDTH': 500, 'HEIGHT' : 500};

function xfnv1a(str) {
    for(var i = 0, h = 2166136261 >>> 0; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return function() {
        h += h << 13; h ^= h >>> 7;
        h += h << 3;  h ^= h >>> 17;
        return (h += h << 5) >>> 0;
    }
}

function sfc32(a, b, c, d) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

class Random {
    constructor(seed) {
       this._seed_func = xfnv1a(seed)
       this._rand = sfc32(this._seed_func(), this._seed_func(), this._seed_func(), this._seed_func());
    }

    randrange(min, max) {
        return Math.floor(this._rand() * (max - min)) + min;
    }

    location(min, max) {
        return new Location(this.randrange(min, max), this.randrange(min, max));
    }
}



function minByKey(items, key) {
    return items.map(item => [item, key(item)])
            .reduce((best, item) => best[1] < item[1] ? best[0] : item[0], [null, Infinity])[1];
}

// dictionary of arrays of times
//TASK_STATS = defaultdict(list)
//STATS = defaultdict(int)

class Clock {
    constructor() {
        this._now = 0;
    }

    advance(time) {
        this._now += time;
    }

    to_dict() {
        return {"now": this._now};
    }

    get now() {
        return this._now;
    }
}

class Stats {
    constructor() {
        this.idle = 0;
        this.working = 0;
        this.tags= {'bathroom': [], 'meal': [], 'med':[]}
    }

    log_idle() {
        this.idle += 1;
    }

    log_working() {
        this.working += 1;
    }

    log_task(tag, delta_time) {
        this.tags[tag].push(delta_time)
    }
}

class Nurse {
    constructor(id, patient_list, start_location, speed, clock, task_algo, idle_algo, stats) {
        this.id = id;
        this.patient_list = patient_list;
        this.speed = speed;
        this.location = start_location;
        this.current_task = null;
        var nurse = this;
        patient_list.forEach(patient => patient.nurse = nurse);
        this.task_queue = [];
        this.clock = clock;
        this.patient_queue = [];
        this.task_algo = task_algo;
        this.idle_algo = idle_algo;
        this.stats = stats;
    }

    add_patient(patient) {
        this.patient_list.push(patient);
        patient.nurse = this;
    }
    
    request(patient, tag, action_list) {
        //console.log("Patient " + str(patient.id) + "requests " + tag)
        for (var i = 0; i < this.task_queue.length; i++) {
            var task = this.task_queue[i];
            if (task[0] == patient && task[1] == tag) {
                // task already requested
                return
            }
        }
        this.task_queue.push([patient, tag, action_list, this.clock.now]);
    }

    update(time) {
        if (!this.current_task && this.task_queue.length > 0) {
            this.current_task = this.task_queue.shift();
        }
        
        // Move
        if (this.current_task) {
            this.stats.log_working();
            var action_list = this.current_task[2];
            var first_action = action_list[0];
            //console.log(first_action)
            if (first_action.are_we_there(this.location)) {
                first_action.update(time);
                if (first_action.complete) {
                    //console.log("Action Complete!")
                    //console.log(vars(self))
                    action_list.shift();
                    if (action_list.length == 0) {
                        var tag = this.current_task[1];
                        var task_time = this.clock.now - this.current_task[3];
                        console.debug("Task Complete: " + tag + " in " + task_time)
                        this.stats.log_task(tag, task_time);
                        var patient = this.current_task[0];
                        this.patient_queue = this.patient_queue.filter(p => p != patient);
                        this.patient_queue.push(patient);
                        this.decide_next_task();
                    }
                }
                    
            } else {
                this.move_to(first_action.where);
            }
        } else {
            this.stats.log_idle();
            if (this.task_queue) {
                this.current_task = this.task_queue.shift();
            } else {
                this.do_idle();
            }
        }
    }

    do_idle() {
        if (this.idle_algo == 'move_towards_least_seen') {
            if (this.patient_queue.length > 0) {
                this.move_to(this.patient_queue[0].location);
            }
        } else if (this.idle_algo == 'move_to_nurse_station') {
            this.move_to(NURSE_STATION);
        } else if (this.idle_algo == 'omniscient') {
            this.patient_list.reduce((accum, p) => p.time_till_next_need < accum.time_till_next_need ? p : accum);
            this.move_to(closest.next_need_location());
        }
        //elif args.idle_algo == 'move_near_depos':
    }
            
    choose_next_task_by_proximity() {
        var prox = this.task_queue.map(task => [task, task[2][0].distance_to(this.location)])
            .reduce((accum, task) => accum[1] < task[1] ? accum[0] : task[0], [null, Infinity])[1];
        console.debug("Proximity choice = " + prox);
    }
    
    choose_next_task_by_first() {
        return this.task_queue[0];
    }

    decide_next_task() {
        if (this.task_queue.length > 0) {
            if (this.task_algo == 'first') {
                this.current_task = this.choose_next_task_by_first();
            } else if (this.task_algo == 'proximity') {
                this.current_task = this.choose_next_task_by_proximity();
            }
            console.debug("Choose Taask")
            console.debug(this.current_task)
            this.task_queue = this.task_queue.filter(task => task != this.current_task);
            //console.log("New Task")
            //console.log(vars(self))
        } else {
            this.current_task = null;
        }
    }

    move_to(dest) {
        var vec = [dest.x - this.location.x, dest.y - this.location.y];
        var norm = Math.sqrt(vec[0] ** 2.0 + vec[1] ** 2.0);
        if (norm < this.speed) {
            this.location = new Location(dest.x, dest.y);
        } else {
            this.location.x += Math.floor((vec[0] / norm) * this.speed);
            this.location.y += Math.floor((vec[1] / norm) * this.speed);
        }
    }

    print_state() {
        console.log("Nurse " + this.id);
        console.log("\tX = " + this.location.x + " Y = " + this.location.y);
        if (this.current_task) {
            console.log("\tCurrent Task " + this.current_task);
        } else {
            console.log("\tIdle");
        }
        if (this.task_queue.length > 0) {
            console.log("\tTask Queue Length " + this.task_queue.length);
        }
    }
}

class Patient {
    constructor(id, nurse, location, conditions, bathroom, diet, medication) {
        this.id = id
        this.nurse = nurse
        this.location = location
        this.conditions = conditions
        this.bathroom = bathroom
        this.diet = diet
        this.medication = medication
    }

    update(time) {
        //console.log(this.id + " patient update")
        this.bathroom.update(time)
        this.diet.update(time)
        this.medication.update(time)
        if (this.bathroom.needed()) {
            console.debug(this.id + " requesting Bathroom");
            this.nurse.request(this, "bathroom", [new Action(BATHROOM_TIME, this.location, this.bathroom)])
        }
        if (this.diet.needed()) {
            this.nurse.request(this, "meal", [new Action(GET_MEAL_TIME, KITCHEN, null), new Action(DIET_TIME, this.location, this.diet)])
        }
        if (this.medication.needed()) {
            this.nurse.request(this, "med", [new Action(GET_MED_TIME, MED_DEPO, null), new Action(MED_TIME, this.location, this.medication)])
        }
    }

    print_state() {
        // console.log("Patient " + str(this.id))
        // console.log("\tX = " + str(this.location.x) + " Y = " + str(this.location.y))
        // if (this.nurse == null) {
        //     //raise Exception("No nurse for patient " + str(this.id))
        // }
        // console.log("\tAssigned Nurse " + str(this.nurse.id))
        // console.log("\tBathroom " + str(this.bathroom.time_till_next))
        // console.log("\tDiet " + str(this.diet.time_till_next))
        // console.log("\tMeds " + str(this.medication.time_till_next))
    }

    next_need() {
        return minByKey([this.bathroom, this.medication, this.diet], n => n.time_till_next);
    }

    time_till_next_need() {
        return this.next_need().time_till_next
    }

    next_need_location() {
        return this.next_need().resource_location
    }

    to_dict() {
        return {
            "id": this.id, 
            "location": this.location,
            "bathroom" : this.bathroom.time_till_next,
            "diet" : this.diet.time_till_next,
            "meds" : this.medication.time_till_next}
    }
}

class Action {
    constructor(time_length, where, need) {
        this.complete = false;
        this.time_left = time_length;
        this.where = where;
        this.need = need;
    }
    
    are_we_there(current_loc) {
        return this.distance_to(current_loc) <= 1;
    }

    distance_to(current_loc) {
        return Math.sqrt((this.where.x - current_loc.x)**2 + (this.where.y - current_loc.y)**2);
    }

    update(time) {
        this.time_left -= time;
        if (this.time_left <= 0) {
            this.complete = true;
            if (this.need) {
                this.need.fullfill();
            }
        }
    }
}
        
class TimedNeed {
    constructor(min_time, max_time, resource_location, random) {
        this.min_time = min_time;
        this.max_time = max_time;
        this.random = random;
        this.resource_location = resource_location;
        this.last = 0;
        this.time_till_next = this.next();
    }
    
    next() {
        return this.random.randrange(this.min_time, this.max_time);
    }

    needed() {
        return this.time_till_next <= 0;
    }
    
    update(time) {
        this.time_till_next -= time;
        //console.log("Need " + this.time_till_next)
    }

    fullfill() {
        this.time_till_next = this.next();
    }
}

class Sim {
    constructor(task_algo, idle_algo, random) {
        this.clock = new Clock();
        this.idle_algo = idle_algo;
        this.task_algo = task_algo;
        this.stats = new Stats();
        this.random = random;

        this._patients = []
        for (var i = 0; i < NUM_PATIENTS; i++) {
            var location = this.random.location(0, BOARD['WIDTH'])
            console.log("New Patient at " + location.x + "," + location.y);
            this._patients.push(new Patient(i, null, location, [], 
                new TimedNeed(BATHROOM_MIN, BATHROOM_MAX, location, random),
                new TimedNeed(DIET_MIN, DIET_MAX, KITCHEN, random), 
                new TimedNeed(MED_MIN, MED_MAX, MED_DEPO, random)))
        }

        this._nurses = []
        for (var i = 0; i < NUM_NURSES; i++) {
            this._nurses.push(new Nurse(i, 
                this._patients.slice(i*PATIENTS_PER_NURSE, i*PATIENTS_PER_NURSE+PATIENTS_PER_NURSE), 
                NURSE_STATION,
                NURSE_SPEED, 
                this.clock, task_algo, idle_algo, this.stats))
        }
    }

    get width() {
        return BOARD['WIDTH'];
    }

    get height() {
        return BOARD['HEIGHT'];
    }

    get med_depo() {
        return MED_DEPO;
    }

    get kitchen() {
        return KITCHEN;
    }

    get patients() {
        return this._patients;
    }

    get nurses() {
        return this._nurses;
    }

    sim_next_frame(frame_num) {
        this.clock.advance(TIME_STEP)
    
        // select next tasks
        this.patients.forEach(patient => patient.update(TIME_STEP));
        
        // move nurses
        this.nurses.forEach(nurse => nurse.update(TIME_STEP));
        //this.nurses.forEach(nurse => nurse.print_state());
    }

    run() {
        for (var j = 0; j < SIM_LENGTH; j++) {
            var state = this.sim_next_frame(j)
        }
    }

    get_stats() {
        var stats_string = ""
        var all_tasks = 0;
        var all_longer_sixty = 0;
        function add(str) {
            stats_string += str + "\n";
        }
        for (var tag in this.stats.tags) {
            var tasks = this.stats.tags[tag];
            all_tasks += tasks.length;
            var sum = tasks.reduce((a, b) => a + b, 0);
            var avg_time = sum / tasks.length;
            var long_tasks = tasks.reduce((a, b) => b > 60 ? a + 1 : a, 0);
            all_longer_sixty += long_tasks;
            add("Tag " + tag + " avg= " + avg_time + " long= " + long_tasks);
        }
        add("Total Tasks: " + all_tasks);
        add("Total Task Failures(long): " + all_longer_sixty);
        add("Failure Rate: " + (all_longer_sixty / all_tasks));
        add("Idle: " + this.stats.idle);
        add("Working: " + this.stats.working);
        add("Busy: " + (this.stats.working / (this.stats.idle + this.stats.working)));
        return stats_string;
    }
}