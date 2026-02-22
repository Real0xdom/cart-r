package com.carter.driver

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import com.google.firebase.FirebaseApp

/**
 * Initializes Firebase before Application.onCreate().
 * ContentProviders run before the Application class, ensuring Firebase is ready
 * when expo-notifications requests the FCM token.
 */
class FirebaseInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        try {
            FirebaseApp.initializeApp(context!!)
        } catch (e: Exception) {
            // Already initialized (e.g. by MainApplication)
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
