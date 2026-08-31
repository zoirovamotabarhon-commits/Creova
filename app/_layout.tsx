import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#121212',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#121212',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Creova AI Dashboard',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="ai-chat"
          options={{
            title: 'AI Chat',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="ai-code"
          options={{
            title: 'Code Studio',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="ai-vision"
          options={{
            title: 'Vision Studio',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </>
  );
}
