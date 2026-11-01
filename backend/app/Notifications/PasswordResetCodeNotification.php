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
            ->subject('Your MusikAralan password reset code')
            ->greeting('Password reset requested')
            ->line('Enter this verification code to reset your MusikAralan password:')
            ->line($this->code)
            ->line('This code expires in 15 minutes. If you did not request a reset, you can ignore this email.');
    }
}
