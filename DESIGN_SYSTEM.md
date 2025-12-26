# Design System - Military Academic Theme

Complete reference for applying the design system across all pages.

## Quick Start

1. Import the design system CSS:
```html
<link rel="stylesheet" href="/path/to/design-system.css">
```

2. Import fonts (Google Fonts):
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

---

## Colors

### Primary Colors
```css
--primary: #556B2F        /* Army green */
--primary-dark: #3d4d22   /* Darker for hovers */
--primary-light: #8b9f6f  /* Lighter for backgrounds */
```

### Semantic Colors (for categorization)
```css
--accent-green: #556B2F   /* Concepts (matches primary) */
--accent-blue: #2d5466    /* Sources */
--accent-gold: #a67c2e    /* People/Authors */
--accent-purple: #674675  /* Tags */
```

Each has a `-light` version for pastel backgrounds.

### State Colors
```css
--success: var(--primary)  /* Green */
--warning: var(--accent-gold) /* Brass */
--error: #8b2d2d          /* Burgundy */
```

### Neutral Grays
```css
--neutral-100 through --neutral-900
```
Use `--neutral-700` for headings, `--neutral-600` for body text.

---

## Buttons

### Primary Button
```html
<button class="btn-primary">Save Changes</button>
```

### Secondary Button (outline)
```html
<button class="btn-secondary">Cancel</button>
```

### Primary Outline
```html
<button class="btn-outline-primary">Outline Action</button>
```

### Destructive
```html
<button class="btn-destructive">Delete</button>
<button class="btn-outline-destructive">Delete Outline</button>
```

### Semantic Colored Buttons
```html
<button class="btn-source">Source Action</button>
<button class="btn-person">Person Action</button>
```

### Icon Button
```html
<button class="icon-btn">
  <i class="fas fa-pen"></i>
</button>
```

---

## Forms

### Text Input
```html
<label class="form-label">Email Address</label>
<input type="text" class="form-input" placeholder="Enter email...">
```

### Required Label
```html
<label class="form-label required">Required Field</label>
```

### With Helper Text
```html
<label class="form-label">Password</label>
<div class="form-helper">Must be at least 8 characters</div>
<input type="password" class="form-input">
```

### With Error
```html
<label class="form-label">Email</label>
<input type="text" class="form-input error" value="invalid">
<div class="form-error">This field is required</div>
```

### Select Dropdown
```html
<label class="form-label">Choose Option</label>
<select class="form-select">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

### Textarea
```html
<label class="form-label">Description</label>
<textarea class="form-textarea" rows="3"></textarea>
```

### Checkbox/Radio
```html
<label class="form-check-item">
  <input type="checkbox">
  <span>Include archived items</span>
</label>
```

---

## Badges & Tags

### Pastel Tags (for cards)
```html
<a href="#" class="tag concept">Grounded Theory</a>
<a href="#" class="tag source">Smith et al.</a>
<a href="#" class="tag person">Strauss</a>
<a href="#" class="tag tag-purple">methodology</a>
```

### Filter Badges (bold pills)
```html
<span class="filter-badge concept">
  Qualitative Methods
  <button>&times;</button>
</span>
<span class="filter-badge source">Smith et al. (2020)</span>
<span class="filter-badge person">Author Name</span>
<span class="filter-badge tag">tag-name</span>
```

---

## Alerts

### Success
```html
<div class="alert alert-success">
  <span class="alert-title"><i class="fas fa-check-circle"></i> Success:</span>
  Your changes have been saved.
</div>
```

### Warning
```html
<div class="alert alert-warning">
  <span class="alert-title"><i class="fas fa-exclamation-triangle"></i> Warning:</span>
  This action cannot be undone.
</div>
```

### Error
```html
<div class="alert alert-error">
  <span class="alert-title"><i class="fas fa-times-circle"></i> Error:</span>
  Failed to save changes.
</div>
```

### Info
```html
<div class="alert alert-info">
  <span class="alert-title"><i class="fas fa-info-circle"></i> Info:</span>
  You have 15 unsaved notes.
</div>
```

---

## Cards

```html
<div class="card">
  <div class="card-header">
    <div class="card-title">Card Title</div>
    <div class="card-actions">
      <button class="icon-btn"><i class="fas fa-pen"></i></button>
    </div>
  </div>
  <div class="card-body">
    <p>Card content goes here...</p>
  </div>
  <div class="card-footer">
    <span>Footer left</span>
    <span>Footer right</span>
  </div>
</div>
```

---

## Toggle Switch

```html
<label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
  <div class="toggle-switch active">
    <div class="toggle-slider"></div>
  </div>
  <span>Enable notifications</span>
</label>
```

Use JavaScript to toggle the `active` class on `.toggle-switch`.

---

## Loading States

### Spinner Button
```html
<button class="btn-primary" disabled>
  <i class="fas fa-spinner loading-spinner"></i> Saving...
</button>
```

### Progress Bar
```html
<div class="progress-bar">
  <div class="progress-bar-fill" style="width: 60%;"></div>
</div>
```

---

## Typography

### Use Display Font (Merriweather)
```html
<h1>Page Title</h1>
<h2>Section Title</h2>
<label class="form-label">Label Text</label>
<button class="btn-primary">Button Text</button>
```

### Use Body Font (Inter)
```html
<p>Body text, descriptions, helper text...</p>
<input class="form-input">
<div class="form-error">Error messages</div>
```

### Font Size Classes
Use CSS variables directly:
```css
font-size: var(--text-xs);   /* 12px */
font-size: var(--text-sm);   /* 14px */
font-size: var(--text-base); /* 15px */
font-size: var(--text-lg);   /* 18px */
font-size: var(--text-xl);   /* 20px */
font-size: var(--text-2xl);  /* 24px */
font-size: var(--text-3xl);  /* 30px */
```

---

## Spacing

Use spacing variables:
```css
padding: var(--space-1);  /* 4px */
padding: var(--space-2);  /* 8px */
padding: var(--space-3);  /* 12px */
padding: var(--space-4);  /* 16px */
padding: var(--space-6);  /* 24px */
padding: var(--space-8);  /* 32px */
```

Or utility classes:
```html
<div class="p-4 m-2">Padded and margined content</div>
```

---

## Border Radius

```css
border-radius: var(--radius-sm);   /* 2px - icon buttons, small tags */
border-radius: var(--radius);      /* 4px - buttons, inputs, cards */
border-radius: var(--radius-full); /* 9999px - pills, badges */
```

Or utility classes:
```html
<div class="rounded">4px rounded</div>
<div class="rounded-sm">2px rounded</div>
<div class="rounded-full">Pill shape</div>
```

---

## Shadows

```css
box-shadow: var(--shadow-sm);    /* Subtle */
box-shadow: var(--shadow);       /* Default */
box-shadow: var(--shadow-md);    /* Medium */
box-shadow: var(--shadow-lg);    /* Large */
box-shadow: var(--shadow-card);  /* For cards */
box-shadow: var(--shadow-sidebar); /* Inset for sidebar */
box-shadow: var(--shadow-nav);   /* For navigation */
```

Or utility classes:
```html
<div class="shadow-md">Shadowed content</div>
```

---

## Color Coding Rules

**ALWAYS use semantic colors consistently:**

- **Concepts**: Green everywhere (badges, tags, links, filters)
- **Sources**: Blue everywhere
- **People**: Brass/gold everywhere
- **Tags**: Purple everywhere

Example:
```html
<!-- In filter pills -->
<span class="filter-badge concept">Grounded Theory</span>

<!-- In card tags -->
<a href="#" class="tag concept">Grounded Theory</a>

<!-- In links -->
<a href="#" style="color: var(--accent-green);">Grounded Theory</a>
```

---

## Icons

Use FontAwesome icons with semantic colors:

```html
<!-- On light backgrounds -->
<i class="fas fa-book icon"></i>  <!-- Will be primary green -->

<!-- On dark backgrounds -->
<i class="fas fa-book icon white"></i>  <!-- Will be white -->
```

---

## Best Practices

1. **Buttons**: Always use display font (Merriweather)
2. **Form Labels**: Use display font
3. **Helper Text**: Use body font (Inter)
4. **Border Radius**: 4px for most things, 2px for small, pills for badges
5. **Shadows**: Prefer shadows over borders for depth
6. **Colors**: Use semantic colors consistently for categorization
7. **Spacing**: Stick to 4px increments (use spacing variables)
8. **Contrast**: All colors are WCAG AA compliant

---

## Rails Integration

In your Rails layouts:

```erb
<%# app/views/layouts/application.html.erb %>
<!DOCTYPE html>
<html>
  <head>
    <%= stylesheet_link_tag "design-system", "data-turbo-track": "reload" %>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  </head>
  <body>
    <%= yield %>
  </body>
</html>
```

Then use the classes throughout your views:

```erb
<button class="btn-primary">
  <%= link_to "New Note", new_note_path %>
</button>

<div class="alert alert-success">
  <span class="alert-title"><i class="fas fa-check-circle"></i> Success:</span>
  <%= notice %>
</div>
```
