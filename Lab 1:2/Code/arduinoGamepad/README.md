# arduinoGamepad
Hybrid branch is final implimentation.

This code emulates a game pad on an arduino and depends on RotaryEncoder.h, Keypad.h, and Joystick.h.
It has support for using rotary encoders, potentiometers, and buttons as input devices.


### Download the Arduino IDE Here
https://www.arduino.cc/en/software

Two libraries can be added through arduino's built in library manager.
To add the libraries, select "Tools" -> "Manage Libraries" then use the search bar on the left to search for the libraries RotaryEncoder and Keypad.

### Installing the Joystick library.
navagate into your arduino libaries folder, mine is located in ../documents/Arduino/Libraries

'''
git clone git@github.com:MHeironimus/ArduinoJoystickLibrary.git
'''

all dependencies are now downloaded

### Uploading your code to the arduino
plug your arduino in.
from the dropdown menu in the top left, make sure your arduno is selected. press the upload arrow in the top left of the IDE
