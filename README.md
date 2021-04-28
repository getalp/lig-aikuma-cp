# LIG Aikuma 

## Development

To develop this project, you will need:
- npm (https://www.npmjs.com/get-npm, to get npm, you will need to install Node.js)

Next, you need to run `npm install` in the main directory.

Depending on your target platform, you will need a native IDE, such as Android Studio or Xcode.

You can then build and open the projet in the native IDE using the following commands provided in `package.json`:
- `npm run android`: Build and open in Android Studio
- `npm run ios`: Build and open in Xcode
- Two more commands `android-live` and `ios-live` are used to generate live-refreshing projects, useful for development.

The path of these IDEs should be resolved automatically but if you encounter the following message:
> ...<br>
> [error] Android Studio not found. Make sure it's installed and configure "windowsAndroidStudioPath" 
> in your capacitor.config.json to point to the location of studio64.exe, using JavaScript-escaped 
> paths: ...

**Do not follow the instruction**, this way of configuring the pass to the native IDE is not universal to
every developer and `capacitor.config.json` should not be changed. Instead of that, please follow the next sections.

### Windows
If the path of Android Studio couldn't be resolved on Windows, you must specify its path in the Windows' registry. To do that,
open the `regedit.exe` program (provided by Windows), and add a key `HKEY_LOCAL_MACHINE\SOFTWARE\Android Studio`, and add a
string value to it named `Path` and set to the path to the installation directory of Android Studio.
