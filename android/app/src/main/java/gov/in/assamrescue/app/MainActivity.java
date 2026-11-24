package gov.in.assamrescue.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import gov.in.assamrescue.app.ble.BleSosPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BleSosPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
