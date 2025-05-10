window.permissionModal = {
    showDeviceNotFoundModal() {
        document.getElementById('modalTitle').textContent = "麦克风未找到";
        document.getElementById('modalMessage').style.display = 'none';
        document.getElementById('modalDeviceNotFoundMessage').style.display = 'block';
        document.getElementById('retryPermissionBtn').textContent = '重试检测';
        document.getElementById('retryPermissionBtn').style.background = '#e74c3c';
        document.getElementById('closeModalBtn').style.display = 'inline-block';
        document.getElementById('permissionModal').style.display = 'flex';
        updateStatus("未找到麦克风设备。请检查设备连接。", "error");
    },
    showPermissionDeniedModal() {
        document.getElementById('modalTitle').textContent = "需要麦克风权限";
        document.getElementById('modalMessage').style.display = 'block';
        document.getElementById('modalDeviceNotFoundMessage').style.display = 'none';
        document.getElementById('retryPermissionBtn').textContent = '授权';
        document.getElementById('retryPermissionBtn').style.background = '#3498db';
        document.getElementById('closeModalBtn').style.display = 'none';
        document.getElementById('permissionModal').style.display = 'flex';
        updateStatus("录音需要麦克风权限。请在弹窗或浏览器设置中授权。", "warn");
    }
};

document.getElementById('retryPermissionBtn').onclick = async function() {
    document.getElementById('permissionModal').style.display = 'none';
    updateStatus("正在尝试获取麦克风权限...", "info");
    
    try {
        // 先尝试检查权限状态
        if (navigator.permissions && navigator.permissions.query) {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state === 'denied') {
                updateStatus("麦克风权限已被系统拒绝。请在浏览器设置中手动允许麦克风权限。", "error");
                // 显示如何修改权限的指导
                const modal = document.getElementById('permissionModal');
                const message = document.getElementById('modalMessage');
                message.innerHTML = `
                    <p>麦克风权限已被系统拒绝。请按以下步骤操作：</p>
                    <ol style="text-align: left; margin: 10px 0;">
                        <li>点击浏览器地址栏左侧的锁图标或信息图标</li>
                        <li>找到"麦克风"权限设置</li>
                        <li>将权限从"阻止"改为"允许"</li>
                        <li>刷新页面后重试</li>
                    </ol>
                `;
                document.getElementById('modalTitle').textContent = "需要修改浏览器设置";
                document.getElementById('retryPermissionBtn').textContent = "我知道了";
                document.getElementById('closeModalBtn').style.display = 'inline-block';
                modal.style.display = 'flex';
                return;
            }
        }

        // 尝试获取麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // 立即停止流
        
        // 如果成功获取权限，则开始录音
        if (window.startRecording) {
            await window.startRecording();
        }
    } catch (error) {
        console.error("重试获取权限失败:", error);
        let errorMessage = "获取麦克风权限失败: ";
        
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            errorMessage += "系统拒绝了麦克风权限。请检查：\n1. 浏览器设置中的麦克风权限\n2. 系统设置中的麦克风权限\n3. 确保没有其他应用正在使用麦克风";
            window.permissionModal.showPermissionDeniedModal();
        } else {
            errorMessage += error.message || "未知错误";
        }
        
        updateStatus(errorMessage, "error");
    }
};
document.getElementById('closeModalBtn').onclick = function() {
    document.getElementById('permissionModal').style.display = 'none';
};