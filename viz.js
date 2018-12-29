// Copyright 2018 Thomas Stanis <tstanis@gmail.com>

var canvas1 = document.getElementById('sim_canvas1');
var canvas2 = document.getElementById('sim_canvas2');
var ctx1 = canvas1.getContext('2d');
var ctx2 = canvas2.getContext('2d');
var sim1 = new Sim('first', 'move_towards_least_seen')
var sim2 = new Sim('proximity', 'omniscient')

current_frame1 = 0
current_frame2 = 0
canvas1.width = sim1.width
canvas1.height = sim1.height
canvas2.width = sim2.width
canvas2.height = sim2.height

ANIMATION_RATE = 0.3
MAX_FRAMES = 1000

window.requestAnimationFrame(drawFrame);

function capAndScale(scalar, domain, scale) {
    var value = Math.min(scalar, domain)
    value = Math.max(value, -domain)
    return Math.round(value * scale);
}

function drawFrame() {
    current_frame1 = draw(ctx1, canvas1, sim1, current_frame1)
    current_frame2 = draw(ctx2, canvas2, sim2, current_frame2)
    window.requestAnimationFrame(drawFrame);
}

function draw(ctx, canvas, sim, current_frame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    //console.log("---Sim " + canvas + "---");
    sim.sim_next_frame(Math.floor(current_frame));
    var patients = sim.patients;

    ctx.fillStyle = 'black';
    ctx.fillText(Math.floor(current_frame), 400, 20)

    // Med
    ctx.fillStyle = 'blue';
    ctx.fillRect(sim.med_depo.x, sim.med_depo.y, 10, 10);

    // Kitchen
    ctx.fillStyle = 'red';
    ctx.fillRect(sim.kitchen.x, sim.kitchen.y, 10, 10);

    
    for(var i = 0; i < patients.length; ++i) {
        //console.log("x=" + patients[i].location.x + "y=" + patients[i].location.y);
        ctx.fillStyle = 'orange';
        ctx.fillRect(patients[i].location.x, patients[i].location.y, 8, 8);
        ctx.fillText(patients[i].id, patients[i].location.x, patients[i].location.y + 20, 20)

        var bathroom = capAndScale(patients[i].bathroom.time_till_next, 100, 0.1);
        var diet = capAndScale(patients[i].diet.time_till_next, 400, 0.02);
        var meds = capAndScale(patients[i].medication.time_till_next, 400, 0.02);

        ctx.fillStyle = 'green';
        ctx.fillRect(patients[i].location.x, patients[i].location.y - 10, bathroom, 3);
        ctx.fillStyle = 'red';
        ctx.fillRect(patients[i].location.x, patients[i].location.y - 6, diet, 3);
        ctx.fillStyle = 'blue';
        ctx.fillRect(patients[i].location.x, patients[i].location.y - 2, meds, 3);
    }

    var nurses = sim.nurses;
    ctx.fillStyle = "black";
    for(var i = 0; i < nurses.length; ++i) {
        ctx.fillRect(nurses[i].location.x, nurses[i].location.y, 4, 4);
        ctx.fillText(nurses[i].id, nurses[i].location.x, nurses[i].location.y + 20, 20);
    }
    current_frame += ANIMATION_RATE
    if(current_frame >= MAX_FRAMES) {
        console.log("====Stats for " + canvas.id);
        sim.print_stats();
        current_frame = 0
    }
    return current_frame
}