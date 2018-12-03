var canvas1 = document.getElementById('sim_canvas1');
var canvas2 = document.getElementById('sim_canvas2');
var ctx1 = canvas1.getContext('2d');
var ctx2 = canvas2.getContext('2d');

current_frame1 = 0.0
current_frame2 = 0.0
canvas1.width = first_sim_config.WIDTH
canvas1.height = first_sim_config.HEIGHT
canvas2.width = proximity_sim_config.WIDTH
canvas2.height = proximity_sim_config.HEIGHT

ANIMATION_RATE = 0.3

window.requestAnimationFrame(drawFrame);

function capAndScale(scalar, domain, scale) {
    var value = Math.min(scalar, domain)
    value = Math.max(value, -domain)
    return Math.round(value * scale);
}

function drawFrame() {
    current_frame1 = draw(ctx1, canvas1, first, first_sim_config, current_frame1)
    current_frame2 = draw(ctx2, canvas2, proximity, proximity_sim_config, current_frame2)
    window.requestAnimationFrame(drawFrame);
}

function draw(ctx, canvas, sim_output, sim_config, current_frame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    var patients = sim_output[Math.floor(current_frame)].patients

    ctx.fillStyle = 'black';
    ctx.fillText(current_frame, 400, 20)

    // Med
    ctx.fillStyle = 'blue';
    ctx.fillRect(sim_config.MED_DEPO.x, sim_config.MED_DEPO.y, 10, 10);

    // Kitchen
    ctx.fillStyle = 'red';
    ctx.fillRect(sim_config.KITCHEN.x, sim_config.KITCHEN.y, 10, 10);

    
    for(var i = 0; i < patients.length; ++i) {
        //console.log("x=" + patients[i].location.x + "y=" + patients[i].location.y);
        ctx.fillStyle = 'orange';
        ctx.fillRect(patients[i].location.x, patients[i].location.y, 8, 8);
        ctx.fillText(patients[i].id, patients[i].location.x, patients[i].location.y + 20, 20)

        var bathroom = capAndScale(patients[i].bathroom, 100, 0.1);
        var diet = capAndScale(patients[i].diet, 400, 0.02);
        var meds = capAndScale(patients[i].meds, 400, 0.02);

        ctx.fillStyle = 'green'
        ctx.fillRect(patients[i].location.x, patients[i].location.y - 10, bathroom, 3);
        ctx.fillStyle = 'red'
        ctx.fillRect(patients[i].location.x, patients[i].location.y - 6, diet, 3);
        ctx.fillStyle = 'blue'
        ctx.fillRect(patients[i].location.x, patients[i].location.y - 2, meds, 3);
    }

    var nurses = sim_output[Math.floor(current_frame)].nurses
    ctx.fillStyle = "black"
    for(var i = 0; i < nurses.length; ++i) {
        ctx.fillRect(nurses[i].location.x, nurses[i].location.y, 4, 4);
        ctx.fillText(nurses[i].id, nurses[i].location.x, nurses[i].location.y + 20, 20)
    }
    current_frame += ANIMATION_RATE
    if(current_frame >= sim_output.length) {
        current_frame = 0
    }
    return current_frame
}