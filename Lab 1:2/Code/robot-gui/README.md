# Rob 204 Space Sim
A web-based robotic arm simulator based on the [Japanese Experiment Module Remote Manipulator System](https://iss.jaxa.jp/en/kibo/about/kibo/rms/) on the International Space Station. The simulator is meant to be controlled by a custom Arduino-powered human interface device. It is used for the class ROB 204: Introduction to Human-Robot Systems at the University of Michigan.

The simulator is hosted at <https://websites.umich.edu/~rob204labs/>.

Forked from <https://github.com/glumb/robot-gui>.

## Installation
1. Clone this repository.

```
   $ git clone https://github.com/twhelgeson/robot-gui.git
```

2. This project uses `npm` to manage packages. Navigate to the project folder and run `npm install` to install all necessary packages.

```
   $ cd robot-gui
   $ npm install
```
   
3. To view the project, run `npx vite`. The output will include a localhost URL where you can preview the project.
   
```
  $ npx vite
```
```
  VITE v4.3.9  ready in 789 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```
  4. Open the localhost URL in a browser of your choice
