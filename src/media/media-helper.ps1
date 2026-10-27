# Puente entre Vinilify y los controles multimedia de Windows (lo mismo que muestra el panel de volumen).
# No necesita cuenta: lee lo que la app de Spotify le informa a Windows.
#
# Salida: una línea JSON por cada cambio.
#   {"type":"media", title, artist, album, playing, positionMs, durationMs, canSeek, volume, cover?}
#   {"type":"none"}  cuando Spotify no está abierto
# Entrada (una orden por línea): toggle | next | previous | seek <ms> | volume <0-100>

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaPlaybackAutoRepeatMode, Windows.Media, ContentType = WindowsRuntime]

# Las APIs de Windows son asíncronas; desde PowerShell hay que esperarlas a mano.
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

# Volumen por aplicación (el del mezclador de volumen de Windows), vía Core Audio.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Vinilify {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorCom {}

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
  }

  [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out IMMDevice device);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }

  [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr groupingParam, int flags, out IntPtr control);
    int GetSimpleAudioVolume(IntPtr groupingParam, int flags, out IntPtr volume);
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
  }

  [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
  }

  [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    int GetState(out int state);
    int GetDisplayName(out IntPtr name);
    int SetDisplayName(IntPtr name, IntPtr context);
    int GetIconPath(out IntPtr path);
    int SetIconPath(IntPtr path, IntPtr context);
    int GetGroupingParam(out Guid param);
    int SetGroupingParam(IntPtr param, IntPtr context);
    int RegisterAudioSessionNotification(IntPtr notifications);
    int UnregisterAudioSessionNotification(IntPtr notifications);
    int GetSessionIdentifier(out IntPtr id);
    int GetSessionInstanceIdentifier(out IntPtr id);
    [PreserveSig] int GetProcessId(out uint pid);
  }

  [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ISimpleAudioVolume {
    [PreserveSig] int SetMasterVolume(float level, ref Guid context);
    [PreserveSig] int GetMasterVolume(out float level);
  }

  public static class AppVolume {
    // Recorre todos los dispositivos de salida activos: Spotify puede sonar por uno que no es el predeterminado.
    static List<ISimpleAudioVolume> Find(string processName) {
      var result = new List<ISimpleAudioVolume>();
      var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom());
      IMMDeviceCollection devices;
      if (enumerator.EnumAudioEndpoints(0, 1, out devices) != 0) return result;
      uint deviceCount;
      devices.GetCount(out deviceCount);
      for (uint d = 0; d < deviceCount; d++) {
        IMMDevice device;
        if (devices.Item(d, out device) != 0) continue;
        Guid iid = typeof(IAudioSessionManager2).GUID;
        object managerObj;
        if (device.Activate(ref iid, 23, IntPtr.Zero, out managerObj) != 0) continue;
        IAudioSessionEnumerator sessions;
        if (((IAudioSessionManager2)managerObj).GetSessionEnumerator(out sessions) != 0) continue;
        int count;
        sessions.GetCount(out count);
        for (int i = 0; i < count; i++) {
          IAudioSessionControl2 control;
          if (sessions.GetSession(i, out control) != 0) continue;
          uint pid;
          control.GetProcessId(out pid);
          if (pid == 0) continue;
          try {
            if (string.Equals(Process.GetProcessById((int)pid).ProcessName, processName, StringComparison.OrdinalIgnoreCase)) {
              result.Add((ISimpleAudioVolume)control);
            }
          } catch {}
        }
      }
      return result;
    }

    public static int Get(string processName) {
      foreach (var volume in Find(processName)) {
        float level;
        if (volume.GetMasterVolume(out level) == 0) return (int)Math.Round(level * 100);
      }
      return -1;
    }

    public static void Set(string processName, int percent) {
      Guid context = Guid.Empty;
      float level = Math.Max(0, Math.Min(100, percent)) / 100f;
      foreach (var volume in Find(processName)) volume.SetMasterVolume(level, ref context);
    }
  }
}
'@

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

Add-Type -AssemblyName System.Drawing
# PowerShell no deja convertir el stream de Windows a IInputStream; por reflexión sí funciona.
$asStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [Type[]]@([Windows.Storage.Streams.IInputStream]))
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)

# Devuelve la portada como data URL en JPEG (Spotify la entrega en PNG, ~5 veces más pesada).
function Read-Cover($props) {
  try {
    if (-not $props.Thumbnail) { return $null }
    $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $net = $asStreamForRead.Invoke($null, @($stream))
    $raw = New-Object System.IO.MemoryStream
    $net.CopyTo($raw)
    $net.Dispose()
    if ($raw.Length -eq 0) { return $null }
    $raw.Position = 0
    $image = [System.Drawing.Image]::FromStream($raw)
    $jpeg = New-Object System.IO.MemoryStream
    $image.Save($jpeg, $jpegCodec, $jpegParams)
    $image.Dispose()
    return 'data:image/jpeg;base64,' + [Convert]::ToBase64String($jpeg.ToArray())
  } catch {
    [Console]::Error.WriteLine("portada: $_")
    return $null
  }
}

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

function Find-Spotify {
  foreach ($session in @($manager.GetSessions())) {
    if ($session.SourceAppUserModelId -match 'spotify') { return $session }
  }
  return $null
}

$script:session = $null
$script:key = $null
$script:trackSent = $false
$script:trackSince = [DateTime]::UtcNow
$script:cover = $null
$script:coverTries = 0
$script:prevCover = $null
$script:noneSent = $false
$script:last = @{ playing = $null; pos = 0; at = [DateTime]::UtcNow; canSeek = $null; volume = -2 }
$script:volumeCheckedAt = [DateTime]::MinValue

function Invoke-Order([string]$line) {
  $parts = $line.Trim().Split(' ')
  $s = $script:session
  switch ($parts[0]) {
    'toggle'   { if ($s) { $null = $s.TryTogglePlayPauseAsync() } }
    'next'     { if ($s) { $null = $s.TrySkipNextAsync() } }
    'previous' { if ($s) { $null = $s.TrySkipPreviousAsync() } }
    'seek'     { if ($s) { $null = $s.TryChangePlaybackPositionAsync([long]$parts[1] * 10000) } }
    'shuffle'  { if ($s) { $null = $s.TryChangeShuffleActiveAsync($parts[1] -eq 'on') } }
    'repeat'   {
      # Mismos nombres que la API de Spotify: off | context (toda la lista) | track (una canción).
      $mode = switch ($parts[1]) { 'track' { 'Track' } 'context' { 'List' } default { 'None' } }
      if ($s) { $null = $s.TryChangeAutoRepeatModeAsync([Windows.Media.MediaPlaybackAutoRepeatMode]$mode) }
    }
    'volume'   {
      [Vinilify.AppVolume]::Set('Spotify', [int]$parts[1])
      $script:last.volume = [int]$parts[1]
    }
  }
}

function Tick {
  $s = Find-Spotify
  $script:session = $s
  if (-not $s) {
    if (-not $script:noneSent) {
      Emit @{ type = 'none' }
      $script:noneSent = $true
      $script:key = $null
    }
    return
  }
  $script:noneSent = $false

  $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $timeline = $s.GetTimelineProperties()
  $info = $s.GetPlaybackInfo()
  $now = [DateTime]::UtcNow
  $changed = $false

  $key = "$($props.Title)|$($props.Artist)|$($props.AlbumTitle)"
  if ($key -ne $script:key) {
    $script:key = $key
    $script:trackSent = $false
    $script:trackSince = $now
    $script:prevCover = $script:cover
    $script:cover = $null
    $script:coverTries = 0
  }

  # La portada a veces llega un poco después del título; se reintenta unas veces.
  # Si sale igual a la de la canción anterior, probablemente Windows aún no la actualizó.
  $age = ($now - $script:trackSince).TotalMilliseconds
  if (-not $script:cover -and $script:coverTries -lt 12 -and $age -gt 200) {
    $script:coverTries++
    $c = Read-Cover $props
    if ($c -and ($c -ne $script:prevCover -or $script:coverTries -ge 4)) {
      $script:cover = $c
      if ($script:trackSent) { $changed = $true }
    }
  }
  # Una canción nueva se anuncia junto con su portada (o tras 1,2 s si no llega).
  $sendCover = $false
  if (-not $script:trackSent) {
    if (-not $script:cover -and $age -lt 1200) { return }
    $script:trackSent = $true
    $changed = $true
    $sendCover = $true
  } elseif ($changed) {
    $sendCover = $true
  }

  $playing = $info.PlaybackStatus.ToString() -eq 'Playing'
  $pos = $timeline.Position.TotalMilliseconds
  if ($playing -and $timeline.LastUpdatedTime.Year -gt 2000) {
    $pos += ([DateTimeOffset]::Now - $timeline.LastUpdatedTime).TotalMilliseconds
  }
  $canSeek = [bool]$info.Controls.IsPlaybackPositionEnabled

  # Saltos de posición (alguien movió la canción desde Spotify).
  $expected = $script:last.pos + $(if ($script:last.playing) { ($now - $script:last.at).TotalMilliseconds } else { 0 })
  if ([Math]::Abs($pos - $expected) -gt 1500) { $changed = $true }
  if ($playing -ne $script:last.playing -or $canSeek -ne $script:last.canSeek) { $changed = $true }

  $shuffle = if ($info.Controls.IsShuffleEnabled -and $null -ne $info.IsShuffleActive) { [bool]$info.IsShuffleActive } else { $null }
  $repeat = if ($info.Controls.IsRepeatEnabled -and $null -ne $info.AutoRepeatMode) {
    switch ($info.AutoRepeatMode.ToString()) { 'Track' { 'track' } 'List' { 'context' } default { 'off' } }
  } else { $null }
  if ($shuffle -ne $script:last.shuffle -or $repeat -ne $script:last.repeat) { $changed = $true }
  $script:last.shuffle = $shuffle
  $script:last.repeat = $repeat

  if (($now - $script:volumeCheckedAt).TotalMilliseconds -gt 1000) {
    $script:volumeCheckedAt = $now
    $volume = [Vinilify.AppVolume]::Get('Spotify')
    if ($volume -ne $script:last.volume) {
      $script:last.volume = $volume
      $changed = $true
    }
  }

  $script:last.playing = $playing
  $script:last.pos = $pos
  $script:last.at = $now
  $script:last.canSeek = $canSeek
  if (-not $changed) { return }

  $msg = [ordered]@{
    type       = 'media'
    title      = $props.Title
    artist     = $props.Artist
    album      = $props.AlbumTitle
    playing    = $playing
    positionMs = [Math]::Round($pos)
    durationMs = [Math]::Round($timeline.EndTime.TotalMilliseconds)
    canSeek    = $canSeek
    shuffle    = $shuffle
    repeat     = $repeat
    volume     = $script:last.volume
  }
  if ($sendCover) { $msg.cover = $script:cover }
  Emit $msg
}

# Bucle principal: atiende órdenes apenas llegan y revisa el estado cada ~350 ms.
# (Ojo: [Console]::In.ReadLineAsync() bloquea en PowerShell 5.1; un StreamReader propio no.)
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pending = $stdin.ReadLineAsync()
while ($true) {
  if ($pending.Wait(350)) {
    $line = $pending.Result
    if ($null -eq $line) { exit 0 }  # Vinilify se cerró
    try { Invoke-Order $line } catch { [Console]::Error.WriteLine("orden '$line': $_") }
    $pending = $stdin.ReadLineAsync()
    continue
  }
  try { Tick } catch { [Console]::Error.WriteLine("lectura: $_") }
}
