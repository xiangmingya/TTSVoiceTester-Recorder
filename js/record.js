let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;
let audioContext = null;
let audioInput = null;
let workletNode = null;
let audioData = [];

// 注册音频处理工作线程
async function registerAudioWorklet() {
    const workletCode = `
        class AudioRecorderProcessor extends AudioWorkletProcessor {
            constructor() {
                super();
                this._bufferSize = 4096;
                this._buffer = new Float32Array(this._bufferSize);
                this._initBuffer();
            }

            _initBuffer() {
                this._bytesWritten = 0;
            }

            process(inputs, outputs) {
                const input = inputs[0];
                if (input.length > 0) {
                    const channel = input[0];
                    for (let i = 0; i < channel.length; i++) {
                        if (this._bytesWritten < this._bufferSize) {
                            this._buffer[this._bytesWritten] = channel[i];
                            this._bytesWritten++;
                        }
                    }

                    if (this._bytesWritten >= this._bufferSize) {
                        this.port.postMessage(this._buffer);
                        this._initBuffer();
                    }
                }
                return true;
            }
        }
        registerProcessor('audio-recorder', AudioRecorderProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
}

window.startRecording = async function() {
    const recordBtn = document.getElementById('recordBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    if (recordBtn.disabled) {
        updateStatus("录音功能当前不可用（可能未检测到麦克风）。", "error");
        return;
    }
    if (isRecording) return;
    try {
        // 检查设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        if (audioInputs.length === 0) {
            window.permissionModal.showDeviceNotFoundModal();
            return;
        }

        // 获取权限
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 44100,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // 检查音频流是否有效
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length === 0) {
            throw new Error("未获取到音频轨道");
        }

        // 创建音频上下文
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100
        });

        // 注册音频处理工作线程
        await registerAudioWorklet();
        
        // 创建音频处理节点
        audioInput = audioContext.createMediaStreamSource(audioStream);
        workletNode = new AudioWorkletNode(audioContext, 'audio-recorder');

        // 处理音频数据
        workletNode.port.onmessage = (event) => {
            if (!isRecording) return;
            const data = new Float32Array(event.data);
            
            // 检查音频数据是否有效
            let hasSound = false;
            let maxValue = 0;
            for (let i = 0; i < data.length; i++) {
                const absValue = Math.abs(data[i]);
                maxValue = Math.max(maxValue, absValue);
                if (absValue > 0.001) { // 恢复正常阈值
                    hasSound = true;
                }
            }
            
            // 始终保存音频数据，但记录音量信息
            audioData.push(data);
            if (hasSound) {
                console.log("检测到有效音频数据，音量:", maxValue.toFixed(6));
            } else {
                console.log("音频电平较低，音量:", maxValue.toFixed(6));
            }
        };

        // 连接节点
        audioInput.connect(workletNode);
        workletNode.connect(audioContext.destination);

        // 添加音频监控
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        audioInput.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function checkAudioLevel() {
            if (!isRecording) return;
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const max = Math.max(...dataArray);
            console.log("音频分析 - 平均电平:", average.toFixed(2), "最大电平:", max);
            
            if (average < 2) { // 恢复正常阈值
                console.log("警告：音频电平过低");
                updateStatus("警告：音频输入电平较低，请确保麦克风正常工作并靠近音源", "warn");
            }
            
            requestAnimationFrame(checkAudioLevel);
        }
        
        checkAudioLevel();

        // 添加音频输入设备信息
        if (audioStream.getAudioTracks().length > 0) {
            const track = audioStream.getAudioTracks()[0];
            console.log("当前使用的音频输入设备:", track.label);
            console.log("音频轨道设置:", track.getSettings());
        }

        document.getElementById('permissionModal').style.display = 'none';

        isRecording = true;
        recordBtn.textContent = "录音中...";
        recordBtn.disabled = true;
        downloadBtn.disabled = false;
        document.getElementById('speakBtn').disabled = true;
        updateStatus("麦克风录音已开始。请点击朗读播放语音，麦克风将尝试录制。", "success");
        document.getElementById('speakBtn').disabled = false;

        // 监控音频流状态
        audioTracks[0].onended = () => {
            console.log("音频轨道已结束");
            resetRecordingState();
        };
        audioTracks[0].onmute = () => {
            console.log("音频轨道已静音");
            updateStatus("警告：麦克风可能被静音", "warn");
        };
        audioTracks[0].onunmute = () => {
            console.log("音频轨道已取消静音");
        };

    } catch (error) {
        console.error("启动录音失败:", error);
        let errorMessage = "启动录音失败: ";
        switch(error.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
                errorMessage += "麦克风权限被拒绝。请检查浏览器和系统设置中的麦克风权限。";
                window.permissionModal.showPermissionDeniedModal();
                break;
            case "NotFoundError":
            case "DevicesNotFoundError":
                errorMessage += "未找到麦克风设备。请检查设备连接。";
                window.permissionModal.showDeviceNotFoundModal();
                break;
            case "NotReadableError":
            case "TrackStartError":
                errorMessage += "无法访问麦克风，可能已被其他应用占用。请关闭其他使用麦克风的应用后重试。";
                break;
            case "AbortError":
                errorMessage += "获取麦克风权限被中止。请重试。";
                break;
            case "SecurityError":
                errorMessage += "安全错误：请确保通过 HTTPS 或 localhost 访问页面。";
                break;
            default:
                errorMessage += error.message || "未知错误";
        }
        updateStatus(errorMessage, "error");
        resetRecordingState();
    }
};

function stopAndDownloadRecording() {
    const recordBtn = document.getElementById('recordBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    if (isRecording) {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        isRecording = false;
        updateStatus("正在停止录音并处理数据...", "info");
        saveRecording();
    } else {
        updateStatus("没有正在进行的录音。", "info");
    }
    recordBtn.textContent = "开始录音";
    recordBtn.disabled = false;
    downloadBtn.disabled = true;
    document.getElementById('speakBtn').disabled = false;
}

function saveRecording() {
    if (audioData.length === 0) {
        updateStatus("没有录到音频数据，无法保存。请确保麦克风正常工作并靠近音源。请查看使用文档。", "warn");
        resetRecordingState();
        return;
    }
    try {
        console.log("开始处理录音数据，数据块数量:", audioData.length);
        
        // 合并所有音频数据
        const length = audioData.reduce((acc, curr) => acc + curr.length, 0);
        console.log("总音频数据长度:", length);
        
        const mergedData = new Float32Array(length);
        let offset = 0;
        for (const data of audioData) {
            mergedData.set(data, offset);
            offset += data.length;
        }

        // 检查合并后的数据
        let maxAmplitude = 0;
        for (let i = 0; i < mergedData.length; i++) {
            maxAmplitude = Math.max(maxAmplitude, Math.abs(mergedData[i]));
        }
        console.log("合并后音频最大振幅:", maxAmplitude.toFixed(6));

        if (maxAmplitude < 0.001) {
            updateStatus("没有录到有效音频数据，无法保存。请确保麦克风正常工作并靠近音源。请查看使用文档。", "warn");
            resetRecordingState();
            return;
        }

        // 创建 MP3 编码器
        const mp3encoder = new lamejs.Mp3Encoder(1, audioContext.sampleRate, 128);
        const sampleBlockSize = 1152;
        const mp3Data = [];

        // 将浮点音频数据转换为整数
        const sampleArray = new Int16Array(mergedData.length);
        for (let i = 0; i < mergedData.length; i++) {
            // 增加音量
            const amplified = mergedData[i] * 1; // 恢复正常增益
            sampleArray[i] = Math.max(-32768, Math.min(32767, amplified * 0x7FFF));
        }

        console.log("开始MP3编码...");
        // 分块编码
        for (let i = 0; i < sampleArray.length; i += sampleBlockSize) {
            const sampleChunk = sampleArray.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        // 完成编码
        const end = mp3encoder.flush();
        if (end.length > 0) {
            mp3Data.push(end);
        }

        console.log("MP3编码完成，数据大小:", mp3Data.reduce((acc, curr) => acc + curr.length, 0));

        // 创建 MP3 Blob
        const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
        const url = URL.createObjectURL(mp3Blob);
        
        // 下载文件
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `麦克风录音_${formatDate(new Date())}.mp3`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        updateStatus("录音已保存为 MP3 格式!", "success");
    } catch (error) {
        console.error("保存录音失败:", error);
        updateStatus("保存录音文件失败，请检查控制台错误。", "error");
    } finally {
        resetRecordingState();
    }
}

function resetRecordingState() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    if (workletNode) {
        workletNode.disconnect();
        workletNode = null;
    }
    if (audioInput) {
        audioInput.disconnect();
        audioInput = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    document.getElementById('recordBtn').textContent = "开始录音";
    document.getElementById('recordBtn').disabled = false;
    document.getElementById('downloadBtn').disabled = true;
    document.getElementById('speakBtn').disabled = false;
    isRecording = false;
    audioData = [];
}

// 事件绑定
document.getElementById('recordBtn').onclick = window.startRecording;
document.getElementById('downloadBtn').onclick = stopAndDownloadRecording;