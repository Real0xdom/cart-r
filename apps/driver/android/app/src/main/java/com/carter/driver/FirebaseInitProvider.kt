package com.carter.driver

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import com.google.firebase.FirebaseApp

import com.google.firebase.FirebaseOptions

/**
 * Initializes Firebase before Application.onCreate().
 * ContentProviders run before the Application class, ensuring Firebase is ready
 * when expo-notifications requests the FCM token.
 */
class FirebaseInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        try {
            if (FirebaseApp.getApps(context!!).isEmpty()) {
                val options = FirebaseOptions.Builder()
                    .setApplicationId("1:670180559382:android:d9e8b0c1f2a3b4c5d6e7")
                    .setProjectId("cartr-78dd3")
                    .setApiKey("AIzaSyAf3e_rktLO-Cca6O38xYnotj5iOx03zM0")
                    .setStorageBucket("cartr-78dd3.firebasestorage.app")
                    .setGcmSenderId("670180559382")
                    .build()
                FirebaseApp.initializeApp(context!!, options)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = 0
}
