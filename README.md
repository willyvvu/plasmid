Plasmid
=======
A concept puzzle game about reversing colorful segments.

Written entirely in HTML, CSS, and JavaScript, using nothing but three.js.

[Play it now, in the browser!](http://willy-vvu.github.io/plasmid) You can learn how to play below.

Take a look at the source code above!

This game features...
---------------------
- 15 plasmids (levels) in 3 genomes (level packs)
- Visuals inspired by [Splice](http://www.cipherprime.com/games/splice), a game by [Cipher Prime](http://www.cipherprime.com/)
- Mobile support with touch and tilt
- Autosave with localStorage
- Offline play with the Application Cache
- [Anaglyph support](http://willy-vvu.github.io/plasmid/#a) for red/blue 3D glasses

*Note: Anaglyph mode interferes with the colors and the playability of the game.*

This game would be better with...
---------------------------------
- Nice ambient music!
- More levels
- A usable level editor
- Fast-paced Reactor and Detonator modes
- Game Controller support
- Leap Motion support
- Adjustable visual quality settings
- A colorblind mode

System Requirements
-------------------
- A WebGL-capable browser such as [Google Chrome](https://www.google.com/intl/en/chrome/browser/) or [Firefox](http://www.mozilla.org/en-US/firefox/new/)
- A decent mobile device / computer

If the game feels slow/choppy, try these tips:

- Try a more powerful device - generally, desktop computers out-power laptops, which out-power phones
- If your device has a battery, check if being plugged in/unplugged makes a difference
- Check the power settings for a "High Performance" mode
- Close some other applications/tabs
- Zoom in with `Ctrl + Plus`

How to play
-----------
Welcome to Plasmid! If you're stuck on a level, take a look below for tips. No spoilers, guaranteed.

Every plasmid (level) begins as several broken segments in a ring.

Your goal is to complete the plasmid, which is to make the colors blend into one another to form a continuous ring of color.

To do so, you must make a certain number of mutations (moves) so that the colors match at each junction between segments.

Each mutation consists of selecting and reversing one or more segments. You can do so by clicking/tapping and dragging from one junction to another.

*Note:* If the selection does not follow what you intended, e.g. you try to select two segments on the bottom, and the selection snaps to the top, don't worry! Both mutations are really just the same mutation if you think about it.

There is no penalty for exceeding the mutation limit. The plasmid will not complete beyond this point, but you may continue making mutations if you wish. You can always Undo or Reset to return to a previous state.

Don't be afraid to experiment and play around! Undo and Reset are there for a reason. If you Undo or Reset too soon, you can always Redo.

You can change levels on the left of the main menu, which you can reveal using Pause.

*Note:* Entering or re-entering a level from the menu will reset it to its original state. If you desire to continue from where you left off, feel free to Redo.

Tips for tricky levels
----------------------
- Try reversing two segments at a time.
- Look for two colors that will match once a segment is reversed.
- Mutations can overlap on top of one another, that is, a single segment can be affected by more than one mutation in a row.
- There is more than one way to solve each plasmid. If you undo or reset too soon, you can still redo.
- Take a break. Sometimes inspiration can strike when we least expect it.

Troubleshooting
---------------
Is the game *running slowly?* See the System Requirements section above.

1. Try using a WebGL capable browser such as [Google Chrome](https://www.google.com/intl/en/chrome/browser/) or [Firefox](http://www.mozilla.org/en-US/firefox/new/) if you aren't already.
2. Your graphics card/phone may not support WebGL. Try using a newer device.
3. Try on your phone if your computer doesn't work or vice-versa.

If all else fails, you can try deleting all level data by typing the following into the URL bar of Plasmid and hitting enter:

`javascript:delete localStorage.plasmid`

**CAUTION: THIS WILL DELETE ALL OF YOUR PROGRESS**