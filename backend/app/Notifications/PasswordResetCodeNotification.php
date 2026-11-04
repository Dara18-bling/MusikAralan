<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetCodeNotification extends Notification
{
    use Queueable;

    public function __construct(public string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('MusikAralan password reset instructions')
            ->greeting('Reset your MusikAralan password')
            ->line('Open MusikAralan and choose "Forgot password" on the login screen. Enter this account email, then the code below and your new password.')
            ->line($this->code)
            ->line('Choose a new password with at least 8 characters, including a letter, a number, and a special character.')
            ->line('This code expires in 15 minutes. If you did not request a reset, you can ignore this email.');
    }
}
