package com.shiye.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

/**
 * 系统分享接收：微信/文件管理器"分享"到拾页的文件与文字。
 * 文件以 URI 暂存，JS 调 getShared() 时经 ContentResolver 读出转 base64；
 * 纯文字分享（无附件）原样交给 JS 走收藏网址流程。
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    private static class SharedItem {
        String name;
        String type;
        Uri uri;
    }

    private final ArrayList<SharedItem> pending = new ArrayList<>();
    private String pendingText = null;

    @Override
    public void load() {
        // 冷启动：分享动作直接拉起 APP，intent 已在 Activity 上
        handleIntent(bridge.getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        // 热启动：launchMode=singleTask，复用实例时走这里
        super.handleOnNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean send = Intent.ACTION_SEND.equals(action);
        boolean sendMultiple = Intent.ACTION_SEND_MULTIPLE.equals(action);
        if (!send && !sendMultiple) return;

        pending.clear();
        pendingText = null;

        if (send) {
            Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (stream != null) {
                pending.add(makeItem(stream, intent.getType()));
            } else {
                pendingText = intent.getStringExtra(Intent.EXTRA_TEXT);
            }
        } else {
            ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (uris != null) {
                for (Uri u : uris) pending.add(makeItem(u, intent.getType()));
            }
        }

        if (!pending.isEmpty() || pendingText != null) {
            JSObject data = new JSObject();
            data.put("count", pending.size());
            data.put("hasText", pendingText != null);
            notifyListeners("sharedReceived", data);
        }
    }

    private SharedItem makeItem(Uri uri, String declaredType) {
        SharedItem it = new SharedItem();
        it.uri = uri;
        it.name = queryName(uri);
        it.type = declaredType;
        // 分享方常声明 */* 或 octet-stream，从 content provider 查更准的真实类型
        if (it.type == null || "*/*".equals(it.type)) {
            String real = bridge.getContext().getContentResolver().getType(uri);
            if (real != null) it.type = real;
        }
        return it;
    }

    @PluginMethod
    public void getShared(PluginCall call) {
        JSArray files = new JSArray();
        try {
            for (SharedItem it : pending) {
                InputStream in = bridge.getContext().getContentResolver().openInputStream(it.uri);
                if (in == null) continue;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                in.close();
                JSObject o = new JSObject();
                o.put("name", it.name != null ? it.name : "shared_file");
                o.put("type", it.type != null ? it.type : "");
                o.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                files.put(o);
            }
        } catch (Exception e) {
            call.reject("读取分享文件失败: " + e.getMessage());
            return;
        }
        pending.clear();
        JSObject result = new JSObject();
        result.put("files", files);
        result.put("text", pendingText);
        pendingText = null;
        call.resolve(result);
    }

    private String queryName(Uri uri) {
        Cursor c = null;
        try {
            c = bridge.getContext().getContentResolver().query(uri, null, null, null, null);
            if (c != null) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (c.moveToFirst() && idx >= 0 && c.getString(idx) != null) return c.getString(idx);
            }
        } catch (Exception e) {
            // 查询失败时退回路径段
        } finally {
            if (c != null) c.close();
        }
        String seg = uri.getLastPathSegment();
        return seg != null ? seg.substring(seg.lastIndexOf('/') + 1) : null;
    }
}
