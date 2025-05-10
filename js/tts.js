const speechSynthesis = window.speechSynthesis;
let selectedVoice = null;
let voicesLoaded = false;
let voiceLoadTimeout = null;

const elements = {
    speakBtn: document.getElementById('speakBtn'),
    stopPlaybackBtn: document.getElementById('stopPlaybackBtn'),
    status: document.getElementById('status'),
    chineseVoicesBtn: document.getElementById('chineseVoicesBtn'),
    otherVoicesBtn: document.getElementById('otherVoicesBtn'),
    voicesDisplay: document.getElementById('voicesDisplay'),
    textInput: document.getElementById('text')
};

let allVoices = [];
let chineseVoices = [];
let otherVoices = [];
let currentType = 'chinese';

function loadVoices() {
    updateStatus("正在加载语音列表...", "info");
    voicesLoaded = false;
    if (voiceLoadTimeout) {
        clearTimeout(voiceLoadTimeout);
        voiceLoadTimeout = null;
    }
    const initialVoices = speechSynthesis.getVoices();
    if (initialVoices.length > 0) {
        handleVoicesLoaded(initialVoices);
        return;
    }
    speechSynthesis.onvoiceschanged = () => {
        handleVoicesLoaded(speechSynthesis.getVoices());
    };
    speechSynthesis.getVoices();
    voiceLoadTimeout = setTimeout(() => {
        if (!voicesLoaded) {
            const currentVoices = speechSynthesis.getVoices();
            if (currentVoices.length === 0) {
                updateStatus("语音加载超时或系统中未安装任何语音引擎。", "error");
                elements.voicesDisplay.innerHTML = '<div style="color:#e74c3c;">语音加载失败。请刷新或检查系统设置。</div>';
            } else {
                handleVoicesLoaded(currentVoices);
            }
        }
    }, 7000);
}

function handleVoicesLoaded(voices) {
    if (voicesLoaded && voices.length > 0 && elements.voicesDisplay.querySelector('.voice-item')) {
        return;
    }
    if (voiceLoadTimeout) {
        clearTimeout(voiceLoadTimeout);
        voiceLoadTimeout = null;
    }
    if (voices.length === 0) {
        if (!voicesLoaded) {
            updateStatus("系统中未检测到任何语音引擎，或浏览器正在初始化。", "info");
        }
        return;
    }
    allVoices = voices;
    chineseVoices = filterChineseVoices(voices);
    otherVoices = voices.filter(v => !chineseVoices.includes(v));
    renderVoices('chinese');
    voicesLoaded = true;
}

function filterChineseVoices(voices) {
    return voices.filter(voice =>
        voice.lang.toLowerCase().startsWith('zh') ||
        voice.name.toLowerCase().includes('chinese') ||
        voice.name.toLowerCase().includes('中文') ||
        voice.name.toLowerCase().includes('mandarin')
    );
}

function renderVoices(type) {
    const container = elements.voicesDisplay;
    container.innerHTML = '';
    container.classList.add('voice-list');
    let voices = type === 'chinese' ? chineseVoices : otherVoices;
    let defaultVoiceSelected = false;
    voices.forEach((voice, index) => {
        const voiceItem = document.createElement('div');
        voiceItem.className = 'voice-item';
        voiceItem.innerHTML = `
            <div class="voice-name">${voice.name}</div>
            <div class="voice-lang">语言: ${voice.lang} ${voice.default ? '(默认)' : ''}</div>
        `;
        voiceItem.addEventListener('click', () => selectVoice(voice, voiceItem, true));
        if (type === 'chinese' && voice.default && voice.lang.toLowerCase().startsWith('zh') && !defaultVoiceSelected) {
            selectVoice(voice, voiceItem, false);
            defaultVoiceSelected = true;
        } else if (type === 'other' && index === 0 && !defaultVoiceSelected && voices.length > 0) {
            document.querySelectorAll('.voice-item.selected').forEach(item => {
                item.classList.remove('selected');
            });
            voiceItem.classList.add('selected');
            selectedVoice = voice;
        }
        container.appendChild(voiceItem);
    });
    if (!voices.length) {
        container.innerHTML = '<div style="color:#e74c3c;">未找到符合条件的音色。</div>';
    } else if (!defaultVoiceSelected && voices.length > 0 && type === 'chinese') {
        const firstVoiceItem = container.querySelector('.voice-item');
        if (firstVoiceItem && !selectedVoice) {
            firstVoiceItem.classList.add('selected');
            selectedVoice = voices[0];
            updateStatus(`已自动选择音色: ${selectedVoice.name}。点击可试听。`, 'info');
        }
    }
}

function selectVoice(voice, voiceItem, playSample = true) {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    document.querySelectorAll('.voice-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    voiceItem.classList.add('selected');
    selectedVoice = voice;
    updateStatus(`已选择音色: ${voice.name}`, 'success');
    if (playSample) {
        const sampleText = "这是一个中文语音测试演示，欢迎使用本工具。";
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onstart = () => console.log(`正在播放音色示例: ${voice.name}`);
        utterance.onend = () => {
            if (!speechSynthesis.speaking) {
                elements.speakBtn.disabled = false;
                elements.stopPlaybackBtn.disabled = true;
            }
        };
        utterance.onerror = (event) => {
            if (event.error === 'interrupted') {
                console.log('语音播放被中断');
                return;
            }
            updateStatus(`音色示例播放失败: ${event.error}`, 'error');
            if (!speechSynthesis.speaking) {
                elements.speakBtn.disabled = false;
                elements.stopPlaybackBtn.disabled = true;
            }
        };
        speechSynthesis.speak(utterance);
    }
}

function speak() {
    if (speechSynthesis.speaking) {
        stopPlayback();
        setTimeout(() => internalSpeak(), 50);
        return;
    }
    internalSpeak();
}

function internalSpeak() {
    if (!selectedVoice) {
        updateStatus("请先选择一个音色", "error");
        const firstVoiceItem = elements.voicesDisplay.querySelector('.voice-item');
        if (firstVoiceItem) {
            if (!document.querySelector('.voice-item.selected')) {
                const allVoices = speechSynthesis.getVoices();
                const chineseVoices = filterChineseVoices(allVoices);
                if (chineseVoices.length > 0) {
                    selectVoice(chineseVoices[0], firstVoiceItem, false);
                }
            }
            if (selectedVoice) {
                updateStatus("已自动选择第一个音色，请再次点击朗读。", "info");
            } else {
                updateStatus("无可用音色，无法朗读。", "error");
            }
        } else {
            updateStatus("无可用音色，无法朗读。", "error");
        }
        return;
    }
    const text = elements.textInput.value.trim();
    if (!text) {
        updateStatus("请输入要朗读的文字", "error");
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
        updateStatus("正在朗读... (请确保您的扬声器已开启，麦克风将尝试拾取声音)", "info");
        elements.speakBtn.disabled = true;
        elements.stopPlaybackBtn.disabled = false;
    };
    utterance.onend = () => {
        updateStatus("朗读完成", "success");
        elements.speakBtn.disabled = false;
        elements.stopPlaybackBtn.disabled = true;
    };
    utterance.onerror = (event) => {
        if (event.error === 'interrupted') {
            console.log('朗读被中断');
            return;
        }
        updateStatus(`朗读出错: ${event.error}`, "error");
        elements.speakBtn.disabled = false;
        elements.stopPlaybackBtn.disabled = true;
    };
    speechSynthesis.speak(utterance);
}

function stopPlayback() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    updateStatus("朗读已停止", "info");
    elements.speakBtn.disabled = false;
    elements.stopPlaybackBtn.disabled = true;
}

elements.speakBtn.addEventListener('click', speak);
elements.stopPlaybackBtn.addEventListener('click', stopPlayback);

elements.chineseVoicesBtn.onclick = () => {
    currentType = 'chinese';
    renderVoices('chinese');
    elements.chineseVoicesBtn.classList.add('active');
    elements.otherVoicesBtn.classList.remove('active');
};
elements.otherVoicesBtn.onclick = () => {
    currentType = 'other';
    renderVoices('other');
    elements.chineseVoicesBtn.classList.remove('active');
    elements.otherVoicesBtn.classList.add('active');
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('voicesDisplay').style.removeProperty('display');
});

document.addEventListener('DOMContentLoaded', loadVoices);