package domain

import "time"

const (
	NotificationDigest   = "weekly_digest"
	NotificationReview   = "review"
	NotificationGoals    = "goals"
	NotificationReminder = "reminders"
)

var NotificationTypes = []string{NotificationDigest, NotificationReview, NotificationGoals, NotificationReminder}

type NotificationPreferences struct {
	Types       map[string]bool `json:"types"`
	Hour        int             `json:"hour"`
	Minute      int             `json:"minute"`
	Weekday     int             `json:"weekday"`
	TimeZone    string          `json:"timeZone"`
	HideAmounts bool            `json:"hideAmounts"`
	Telegram    bool            `json:"telegram"`
}

type Notification struct {
	ID             string     `json:"id"`
	Identity       string     `json:"-"`
	Kind           string     `json:"kind"`
	Title          string     `json:"title"`
	Body           string     `json:"body"`
	CreatedAt      time.Time  `json:"createdAt"`
	ReadAt         *time.Time `json:"readAt"`
	DismissedAt    *time.Time `json:"dismissedAt"`
	DeliveryStatus string     `json:"deliveryStatus"`
	Attempts       int        `json:"attempts"`
	LastError      string     `json:"lastError"`
}
