/**
 * CREOVA
 * Shared translation schema.
 *
 * This schema describes the translation keys
 * currently used by the application.
 */

export interface TranslationSchema {
  common: {
    appName: string;
    error: string;
    success: string;
  };

  aiVideo: {
    title: string;
    subtitle: string;
    promptPlaceholder: string;
    generateButton: string;
    emptyPromptTitle: string;
    emptyPromptMessage: string;
    statusTitle: string;
    progressLabel: string;
    videoErrorTitle: string;
    videoStatusError: string;
    videoReadyTitle: string;
    videoReadyMessage: string;
    videoReadyNoUrl: string;
    videoFailedTitle: string;
    videoFailedStatus: string;
    videoTooLongTitle: string;
    videoTooLongMessage: string;
    videoCheckError: string;
    generationFailed: string;
    unexpectedError: string;
    noUrlYet: string;
    idLabel: string;
  };

  aiVoice: {
    title: string;
    subtitle: string;
    textPlaceholder: string;
    generateButton: string;
    emptyTextMessage: string;
    generationFailedTitle: string;
    generationFailedMessage: string;
    noAudioMessage: string;
    readyMessage: string;
    unexpectedError: string;
    resultTitle: string;
    resultText: string;
    play: string;
    pause: string;
    audioErrorTitle: string;
    audioErrorMessage: string;
  };

  profile: {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    saveButton: string;
    nameRequired: string;
    loadFailed: string;
    updateFailed: string;
    updateSuccess: string;
  };
}
