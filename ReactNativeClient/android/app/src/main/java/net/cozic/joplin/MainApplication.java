package net.cozic.joplin;

import android.app.Application;

import com.facebook.react.ReactApplication;
import com.reactnativecommunity.slider.ReactSliderPackage;
import com.reactnativecommunity.webview.RNCWebViewPackage;
import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;
import com.vinzscam.reactnativefileviewer.RNFileViewerPackage;
import net.rhogan.rnsecurerandom.RNSecureRandomPackage;
import com.imagepicker.ImagePickerPackage;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.soloader.SoLoader;
import com.oblador.vectoricons.VectorIconsPackage;
import com.reactnativedocumentpicker.ReactNativeDocumentPicker;
import com.RNFetchBlob.RNFetchBlobPackage;
import com.rnfs.RNFSPackage;
import fr.bamlab.rnimageresizer.ImageResizerPackage;
import org.pgsqlite.SQLitePluginPackage;
import org.reactnative.camera.RNCameraPackage;

import com.alinz.parkerdan.shareextension.SharePackage;

import cx.evermeet.versioninfo.RNVersionInfoPackage;

import java.util.Arrays;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

	private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
		@Override
		public boolean getUseDeveloperSupport() {
			return BuildConfig.DEBUG;
		}

		@Override
		protected List<ReactPackage> getPackages() {
			return Arrays.<ReactPackage>asList(
				new MainReactPackage(),
            new ReactSliderPackage(),
            new RNCWebViewPackage(),
            new ReactNativePushNotificationPackage(),
				new ImageResizerPackage(),
				new RNFileViewerPackage(),
				new RNSecureRandomPackage(),
				new ImagePickerPackage(),
				new ReactNativeDocumentPicker(),
				new RNFetchBlobPackage(),
				new RNFSPackage(),
				new SQLitePluginPackage(),
				new VectorIconsPackage(),
				new SharePackage(),
				new RNCameraPackage(),
				new RNVersionInfoPackage()
			);
		}
	};

	@Override
	public ReactNativeHost getReactNativeHost() {
		return mReactNativeHost;
	}

	@Override
	public void onCreate() {
		super.onCreate();
		SoLoader.init(this, /* native exopackage */ false);
	}
}
