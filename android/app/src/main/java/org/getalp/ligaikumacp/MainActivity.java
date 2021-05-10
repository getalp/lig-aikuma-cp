package org.getalp.ligaikumacp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

	@Override
	public void onCreate(Bundle savedInstanceState) {

		super.onCreate(savedInstanceState);
		this.registerPlugin(NativePlugin.class);

		// Initializes the Bridge
		/*this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
			// Additional plugins you've installed go here
			// Ex: add(TotallyAwesomePlugin.class);
			// add(VoiceRecorder.class);
		}});*/

	}

}
