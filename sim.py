import datetime
import logging
import random
import math
import numpy as np
from collections import defaultdict
import json
import copy
from pprint import pprint
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--algo", default="first")
parser.add_argument("--output_name", default="sim_output")
args = parser.parse_args()

SIM_LENGTH = 10000

TIME_STEP = 1
NUM_NURSES = 2
NUM_PATIENTS = 4
PATIENTS_PER_NURSE = 2
NURSE_SPEED = 40

BATHROOM_MIN = 100
BATHROOM_MAX = 240
BATHROOM_TIME = 1

DIET_MIN = 8 * 60
DIET_MAX = 12 * 60
GET_MEAL_TIME = 1
DIET_TIME = 15

MED_MIN = 8 * 60
MED_MAX = 12 * 60
GET_MED_TIME = 5
MED_TIME = 1

class Location:
    def __init__(self, x, y):
        self.x = x
        self.y = y

KITCHEN = Location(220, 250)
MED_DEPO = Location(270, 250)
NURSE_STATION = Location(250, 250)

BOARD = {'KITCHEN' : KITCHEN, 'MED_DEPO' : MED_DEPO, 'NURSE_STATION' : NURSE_STATION, 'WIDTH': 500, 'HEIGHT' : 500}

# dictionary of arrays of times
TASK_STATS = defaultdict(list)
STATS = defaultdict(int)

class Clock:
    def __init__(self):
        self.now = 0

    def advance(self, time):
        self.now += time
    
    def get(self):
        return self.now
    
    def to_dict(self):
        return {"now": self.now}

class Nurse:
    def __init__(self, id, patient_list, start_location, speed, clock):
        self.id = id
        self.patient_list = patient_list
        self.speed = speed
        self.location = start_location
        self.current_task = None
        for patient in patient_list:
            patient.nurse = self
        self.task_queue = []
        self.clock = clock

    def add_patient(self, patient):
        self.patient_list.append(patient)
        patient.nurse = self
    
    def request(self, patient, tag, action_list):
        #print "Patient " + str(patient.id) + "requests " + tag
        for tasks in self.task_queue:
            # task already requested
            if tasks[0] == patient and tasks[1] == tag:
                return
        self.task_queue.append((patient, tag, action_list, self.clock.get()))

    def update(self, time):
        if not self.current_task and len(self.task_queue) > 0:
            self.current_task = self.task_queue.pop(0)
        
        # Move
        if self.current_task:
            STATS['working'] += 1
            action_list = self.current_task[2]
            first_action = action_list[0]
            if first_action.are_we_there(self.location):
                first_action.update(time)
                if first_action.complete:
                    #print "Action Complete!"
                    #pprint(vars(self))
                    action_list.pop(0)
                    if len(action_list) == 0:
                        tag = self.current_task[1]
                        task_time = self.clock.get() - self.current_task[3]
                        #print("Task Complete: " + tag + " in " + str(task_time))
                        TASK_STATS[tag].append(task_time)
                        self.decide_next_task()
                    
            else:
                self.move_to(first_action.where)
        else:
            STATS['idle'] += 1
            if self.task_queue:
                self.current_task = self.task_queue.pop(0)
    
    def choose_next_task_by_proximity(self):
        closest_task = min(self.task_queue, key=lambda task: task[2][0].distance_to(self.location))
        return closest_task
    
    def choose_next_task_by_first(self):
        return self.task_queue[0]

    def decide_next_task(self):
        if len(self.task_queue) > 0:

            if args.algo == 'first':
                self.current_task = self.choose_next_task_by_first()
            elif args.algo == 'proximity':
                self.current_task = self.choose_next_task_by_proximity()
            self.task_queue.remove(self.current_task)
            #print("New Task")
            #pprint(vars(self))
        else:
            self.current_task = None

    def move_to(self, dest):
        vec = [dest.x - self.location.x, dest.y - self.location.y]
        norm = math.sqrt(vec[0] ** 2.0 + vec[1] ** 2.0)
        if (norm < self.speed):
            self.location = copy.copy(dest)
        else:
            self.location.x += (vec[0] / norm) * self.speed
            self.location.y += (vec[1] / norm) * self.speed

    def print_state(self):
        print("Nurse " + str(self.id))
        print("\tX = " + str(self.location.x) + " Y = " + str(self.location.y))
        if self.current_task:
            print("\tCurrent Task " + str(self.current_task))
        else:
            print("\tIdle")
        if len(self.task_queue) > 0:
            print("\tTask Queue Length " + str(len(self.task_queue)))




class Patient:
    def __init__(self, id, nurse, location, conditions, bathroom, diet, medication):
        self.id = id
        self.nurse = nurse
        self.location = location
        self.conditions = conditions
        self.bathroom = bathroom
        self.diet = diet
        self.medication = medication

    def update(self, time):
        self.bathroom.update(time)
        self.diet.update(time)
        self.medication.update(time)
        if self.bathroom.needed():
            self.nurse.request(self, "bathroom", [Action(BATHROOM_TIME, self.location, self.bathroom)])
        if self.diet.needed():
            self.nurse.request(self, "meal", [Action(GET_MEAL_TIME, KITCHEN, None),  Action(DIET_TIME, self.location, self.diet)])
        if self.medication.needed():
            self.nurse.request(self, "med", [Action(GET_MED_TIME, MED_DEPO, None), Action(MED_TIME, self.location, self.medication)])

    def print_state(self):
        print("Patient " + str(self.id))
        print("\tX = " + str(self.location.x) + " Y = " + str(self.location.y))
        if not self.nurse:
            raise Exception("No nurse for patient " + str(self.id))
        print("\tAssigned Nurse " + str(self.nurse.id))
        print("\tBathroom " + str(self.bathroom.time_till_next))
        print("\tDiet " + str(self.diet.time_till_next))
        print("\tMeds " + str(self.medication.time_till_next))

    def to_dict(self):
        return {
            "id": self.id, 
            "location": self.location,
            "bathroom" : self.bathroom.time_till_next,
            "diet" : self.diet.time_till_next,
            "meds" : self.medication.time_till_next}


class Action:
    def __init__(self, time_length, where, need):
        self.complete = False
        self.time_left = time_length
        self.where = where
        self.need = need
    
    def are_we_there(self, current_loc):
        return self.distance_to(current_loc) <= 1

    def distance_to(self, current_loc):
        return math.sqrt((self.where.x - current_loc.x)**2 + (self.where.y - current_loc.y)**2)

    def update(self, time):
        self.time_left -= time
        if self.time_left <= 0:
            self.complete = True
            if self.need:
                self.need.fullfill()
        
class TimedNeed:
    def __init__(self, min_time, max_time):
        self.min_time = min_time
        self.max_time = max_time
        self.last = 0
        self.time_till_next = self.next()
    
    def next(self):
        return random.randrange(self.min_time, self.max_time)

    def needed(self):
        return self.time_till_next <= 0
    
    def update(self, time):
        self.time_till_next -= time

    def fullfill(self):
        self.time_till_next = self.next()


def random_location(min, max):
    return Location(random.randrange(min, max), random.randrange(min, max))

class SimJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Nurse):
            return {"id": obj.id, "location": obj.location}
        if isinstance(obj, Location):
            return {"x": obj.x, "y": obj.y}
        if isinstance(obj, Patient) or isinstance(obj, Clock):
            return obj.to_dict()
        return json.JSONEncoder.default(self, obj)

random.seed(0)

clock = Clock()

patients = []
for i in range(0, NUM_PATIENTS):
    patients.append(Patient(i, None, random_location(0, BOARD['WIDTH']), [], TimedNeed(BATHROOM_MIN, BATHROOM_MAX),
        TimedNeed(DIET_MIN, DIET_MAX), TimedNeed(MED_MIN, MED_MAX)))

nurses = []
for i in range(0, NUM_NURSES):
    nurses.append(Nurse(i, 
        patients[i*PATIENTS_PER_NURSE:i*PATIENTS_PER_NURSE+PATIENTS_PER_NURSE], 
        copy.copy(NURSE_STATION), 
        NURSE_SPEED, 
        clock))

f = open(args.output_name + ".json", "w")
f.write("var " + args.output_name + "_sim_config = \n")
f.write(json.dumps(BOARD, cls=SimJSONEncoder))
f.write(";\n")
f.write("var " + args.output_name + " = [\n")
for j in range(0, SIM_LENGTH):
    if j != 0:
        f.write(",")
    clock.advance(TIME_STEP)

    # select next tasks
    for patient in patients:
        patient.update(TIME_STEP)
    
    # move nurses
    for nurse in nurses:
        nurse.update(TIME_STEP)

    state = {'clock': clock, 'patients': patients, 'nurses': nurses}
    f.write(json.dumps(state, cls=SimJSONEncoder))
    # print out the state
    # for patient in patients:
    #     patient.print_state()
    
    # for nurse in nurses:
    #     nurse.print_state()
    
f.write("]")
print "STATS!"
all_longer_sixty = 0
all_tasks = 0
for key in TASK_STATS.keys():
    print(key)
    num_tasks = len(TASK_STATS[key])
    all_tasks += num_tasks
    print("NUM: " + str(num_tasks))
    print("AVERAGE TIME: "+ str(np.mean(TASK_STATS[key])))
    longer = sum(np.array(TASK_STATS[key]) > 60)
    all_longer_sixty += longer
    print("LONGER THAN 60: " + str(longer))
print "Total Tasks: " + str(all_tasks)
print "Total Task Failures: " + str(all_longer_sixty)
print "Failure Rate: " + str(all_longer_sixty / (float(all_tasks)))
idle = STATS["idle"]
working = STATS["working"]
print "Idle: " + str(idle)
print "Working: " + str(working)
print "Busy: " + str(working / float(idle + working))